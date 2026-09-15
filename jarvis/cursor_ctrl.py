"""Cursor ACP / CLI adapter.

Programmatic interface (researched 2026-09-15 from cursor.com/docs/cli/acp):

- Preferred: spawn `agent acp` and speak Agent Client Protocol JSON-RPC
  over stdio (newline-delimited JSON). Flow: initialize → authenticate
  (cursor_login) → session/new or session/load → session/prompt →
  session/update notifications → session/request_permission → session/cancel.
- Also: `agent -p --output-format json` print mode for one-shot tasks.
- MCP is separate (tools for the agent). ACP is how JARVIS drives Cursor.

This adapter never pretends the CLI is connected. If the binary or login is
missing it reports DISCONNECTED / NEEDS_AUTH and the orchestrator may use the
local $0 coding worker instead.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class CursorStatus:
    binary: str | None
    mode: str
    health: str
    detail: str
    authenticated: bool = False


class AcpError(RuntimeError):
    pass


class AcpClient:
    """Newline-delimited JSON-RPC 2.0 ACP client."""

    def __init__(self, argv: list[str], cwd: str | None = None, env: dict[str, str] | None = None) -> None:
        self.argv = argv
        self.cwd = cwd
        self.env = env
        self.proc: subprocess.Popen[str] | None = None
        self._id = 0
        self._pending: dict[int, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.updates: list[dict[str, Any]] = []
        self.permission_handler: Callable[[dict[str, Any]], dict[str, Any]] | None = None
        self._reader: threading.Thread | None = None

    def start(self) -> None:
        self.proc = subprocess.Popen(
            self.argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=self.cwd,
            env=self.env,
            bufsize=1,
        )
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    def close(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                if self.proc.stdin:
                    self.proc.stdin.close()
            except OSError:
                pass
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def _read_loop(self) -> None:
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "id" in msg and ("result" in msg or "error" in msg):
                with self._lock:
                    waiter = self._pending.get(msg["id"])
                if waiter is not None:
                    waiter["response"] = msg
                    waiter["event"].set()
                continue
            method = msg.get("method")
            if method == "session/update":
                self.updates.append(msg.get("params") or {})
            elif method == "session/request_permission":
                outcome = {"outcome": {"outcome": "selected", "optionId": "reject-once"}}
                if self.permission_handler:
                    outcome = self.permission_handler(msg.get("params") or {})
                if "id" in msg:
                    self._respond(msg["id"], outcome)

    def _respond(self, req_id: Any, result: dict[str, Any]) -> None:
        self._write({"jsonrpc": "2.0", "id": req_id, "result": result})

    def _write(self, payload: dict[str, Any]) -> None:
        if not self.proc or not self.proc.stdin:
            raise AcpError("ACP process is not running")
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()

    def request(self, method: str, params: dict[str, Any] | None = None, timeout: float = 30.0) -> dict[str, Any]:
        with self._lock:
            self._id += 1
            req_id = self._id
            event = threading.Event()
            self._pending[req_id] = {"event": event, "response": None}
        self._write({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        if not event.wait(timeout):
            raise AcpError(f"Timeout waiting for {method}")
        with self._lock:
            msg = self._pending.pop(req_id)["response"]
        if not msg:
            raise AcpError(f"No response for {method}")
        if "error" in msg:
            raise AcpError(str(msg["error"]))
        return msg.get("result") or {}

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        self._write({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def initialize(self) -> dict[str, Any]:
        return self.request(
            "initialize",
            {
                "protocolVersion": 1,
                "clientCapabilities": {
                    "fs": {"readTextFile": False, "writeTextFile": False},
                    "terminal": False,
                },
                "clientInfo": {"name": "jarvis", "version": "0.1.0"},
            },
        )

    def authenticate(self) -> dict[str, Any]:
        return self.request("authenticate", {"methodId": "cursor_login"})

    def session_new(self, cwd: str) -> str:
        result = self.request("session/new", {"cwd": cwd, "mcpServers": []})
        return str(result.get("sessionId") or "")

    def session_load(self, session_id: str) -> dict[str, Any]:
        return self.request("session/load", {"sessionId": session_id})

    def session_prompt(self, session_id: str, text: str, timeout: float = 120.0) -> dict[str, Any]:
        return self.request(
            "session/prompt",
            {"sessionId": session_id, "prompt": [{"type": "text", "text": text}]},
            timeout=timeout,
        )

    def session_cancel(self, session_id: str) -> None:
        self.notify("session/cancel", {"sessionId": session_id})


class CursorAdapter:
    def __init__(self) -> None:
        self.session_id: str | None = None
        self.client: AcpClient | None = None
        self.last_status = self.status()

    def discover_binary(self) -> str | None:
        for name in ("agent", "cursor-agent", "cursor"):
            found = shutil.which(name)
            if found:
                return found
        home_agent = os.path.expanduser("~/.local/bin/agent")
        if os.path.isfile(home_agent):
            return home_agent
        return None

    def status(self) -> CursorStatus:
        binary = self.discover_binary()
        if not binary:
            return CursorStatus(
                None,
                "acp",
                "disconnected",
                "Cursor CLI was not found. Install it on the Mac with the official installer, then run agent login. JARVIS will not click the Cursor GUI.",
            )
        env_key = bool(os.environ.get("CURSOR_API_KEY") or os.environ.get("CURSOR_AUTH_TOKEN"))
        return CursorStatus(
            binary,
            "acp",
            "needs_auth" if not env_key else "ready",
            f"Found {binary}. Programmatic control uses `agent acp` (JSON-RPC) or `agent -p`.",
            authenticated=env_key,
        )

    def submit(
        self,
        prompt: str,
        cwd: str,
        *,
        permission_handler: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
        timeout: float = 15.0,
    ) -> dict[str, Any]:
        status = self.status()
        if not status.binary:
            return {
                "ok": False,
                "disconnected": True,
                "status": status.health,
                "detail": status.detail,
            }
        argv = [status.binary, "acp"]
        client = AcpClient(argv, cwd=cwd)
        client.permission_handler = permission_handler
        try:
            client.start()
            # If the process dies immediately, report disconnected rather than hanging.
            time.sleep(0.15)
            if client.proc and client.proc.poll() is not None:
                err = ""
                if client.proc.stderr:
                    err = client.proc.stderr.read() or ""
                return {
                    "ok": False,
                    "disconnected": True,
                    "status": "disconnected",
                    "detail": f"Cursor ACP exited immediately. {err[:500]}",
                }
            client.initialize()
            if status.authenticated:
                try:
                    client.authenticate()
                except AcpError as exc:
                    return {
                        "ok": False,
                        "disconnected": False,
                        "status": "needs_auth",
                        "detail": str(exc),
                    }
            session_id = client.session_new(cwd)
            self.session_id = session_id
            result = client.session_prompt(session_id, prompt, timeout=timeout)
            return {
                "ok": True,
                "disconnected": False,
                "status": "completed",
                "session_id": session_id,
                "result": result,
                "updates": list(client.updates),
            }
        except Exception as exc:
            return {
                "ok": False,
                "disconnected": True,
                "status": "error",
                "detail": str(exc),
            }
        finally:
            client.close()

    def cancel(self) -> None:
        if self.client and self.session_id:
            try:
                self.client.session_cancel(self.session_id)
            except Exception:
                pass
            self.client.close()

    def print_mode(self, prompt: str, cwd: str) -> dict[str, Any]:
        status = self.status()
        if not status.binary:
            return {"ok": False, "disconnected": True, "detail": status.detail}
        try:
            completed = subprocess.run(
                [status.binary, "-p", prompt, "--output-format", "json"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=20,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "disconnected": True, "detail": str(exc)}
        return {
            "ok": completed.returncode == 0,
            "disconnected": False,
            "stdout": completed.stdout[-8000:],
            "stderr": completed.stderr[-2000:],
            "returncode": completed.returncode,
        }
