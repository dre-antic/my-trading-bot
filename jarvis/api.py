"""Local HTTP API + static GUI. Bound to 127.0.0.1 only."""

from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .app import App, create_app
from .kernel import KERNEL
from .paths import workspace_root
from .secrets import redact
from .types import ApprovalDecision, AutonomyMode, MemoryKind

WEB_ROOT = Path(__file__).resolve().parent / "web"


class JarvisHandler(SimpleHTTPRequestHandler):
    app: App

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _send(self, code: int, payload: Any, content_type: str = "application/json") -> None:
        if content_type == "application/json":
            body = json.dumps(payload, default=str).encode("utf-8")
        else:
            body = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        app = self.app
        if path == "/api/status":
            doctor = app.doctor.inspect()
            runtime = app.runtime.snapshot()
            return self._send(
                200,
                {
                    "name": "JARVIS",
                    "product": "local-mac-runtime",
                    "mode": KERNEL.mode.value,
                    "halt": KERNEL.halt.value,
                    "observe": KERNEL.observe_active,
                    "workspace": str(workspace_root()),
                    "cursor": app.cursor.status().__dict__,
                    "cost": app.cost.totals(),
                    "voice": app.voice.status(),
                    "system": doctor,
                    "runtime": runtime,
                    "cloud_ai": runtime["cloud_ai"],
                },
            )
        if path == "/api/runtime":
            return self._send(200, app.runtime.snapshot())
        if path == "/api/runtime/workspace":
            return self._send(200, app.runtime.list_workspace())
        if path == "/api/runtime/applications":
            return self._send(200, {"applications": app.runtime.list_applications(), "mac": app.runtime.is_mac()})
        if path == "/api/missions":
            return self._send(200, app.missions.list())
        if path.startswith("/api/missions/") and path.count("/") == 3:
            mission_id = path.rsplit("/", 1)[-1]
            try:
                return self._send(200, app.missions.get(mission_id))
            except KeyError:
                return self._send(404, {"error": "missing"})
        if path == "/api/projects":
            return self._send(200, app.projects.list())
        if path == "/api/memory":
            return self._send(200, app.memory.list())
        if path == "/api/permissions":
            return self._send(200, app.permissions.pending())
        if path == "/api/providers":
            return self._send(200, app.providers.list())
        if path == "/api/audit":
            return self._send(200, app.audit.recent())
        if path == "/api/activity":
            notes = app.notifications.list()
            missions = app.missions.list(20)
            return self._send(200, {"notifications": notes, "missions": missions})
        if path == "/api/system":
            return self._send(200, {"inspect": app.doctor.inspect(), "runtime": app.runtime.snapshot(), "fixes": []})
        if path == "/api/mcp":
            return self._send(200, app.mcp.list())
        if path == "/api/credentials":
            return self._send(200, app.credentials.list_public())
        if path == "/api/tools":
            return self._send(200, [t.__dict__ for t in app.tools.list()])
        if path == "/api/schedule":
            return self._send(200, app.schedule.list())
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        app = self.app
        body = self._read_json()
        if path == "/api/chat":
            text = (body.get("text") or "").strip()
            result = app.orchestrator.handle_text(text)
            return self._send(200, _safe(result))
        if path == "/api/stop":
            KERNEL.stop_now()
            for item in app.missions.active():
                app.missions.cancel(item["id"])
            return self._send(200, {"halt": KERNEL.halt.value})
        if path == "/api/pause":
            KERNEL.pause_safely()
            for item in app.missions.active():
                if item["status"] != "PAUSED":
                    try:
                        app.missions.pause(item["id"])
                    except Exception:
                        continue
            return self._send(200, {"halt": KERNEL.halt.value})
        if path == "/api/resume":
            KERNEL.clear_halt()
            return self._send(200, {"halt": KERNEL.halt.value})
        if path == "/api/mode":
            KERNEL.set_mode(AutonomyMode(body.get("mode", "ASSIST")))
            return self._send(200, {"mode": KERNEL.mode.value})
        if path == "/api/observe/stop":
            KERNEL.stop_observe()
            return self._send(200, {"observe": False})
        if path == "/api/system/fix":
            return self._send(200, {"done": app.doctor.autofix_low_risk()})
        if path.endswith("/approve"):
            approval_id = path.split("/")[-2]
            row = app.permissions.decide(approval_id, ApprovalDecision.APPROVE)
            return self._send(200, dict(row) | {"status": "APPROVE"})
        if path.endswith("/reject"):
            approval_id = path.split("/")[-2]
            row = app.permissions.decide(approval_id, ApprovalDecision.REJECT)
            return self._send(200, dict(row) | {"status": "REJECT"})
        if path.startswith("/api/missions/") and path.endswith("/resume"):
            mission_id = path.split("/")[3]
            KERNEL.clear_halt()
            mission = app.missions.resume(mission_id)
            ran = app.orchestrator.run_mission(mission["id"])
            return self._send(200, ran)
        if path.startswith("/api/missions/") and path.endswith("/cancel"):
            mission_id = path.split("/")[3]
            return self._send(200, app.missions.cancel(mission_id))
        if path == "/api/memory":
            item = app.memory.add(MemoryKind(body.get("kind", "USER")), body.get("title", ""), body.get("body", ""))
            return self._send(201, item)
        if path == "/api/mcp/connect":
            return self._send(200, app.mcp.connect(body.get("identity", ""), body.get("source", "")))
        if path == "/api/trading/execute":
            return self._send(200, app.trading.execute(body.get("order") or {}))
        return self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/memory/"):
            memory_id = parsed.path.rsplit("/", 1)[-1]
            self.app.memory.delete(memory_id)
            return self._send(204, {})
        return self._send(404, {"error": "not found"})


def _safe(payload: Any) -> Any:
    text = json.dumps(payload, default=str)
    return json.loads(redact(text))


def make_server(host: str = "127.0.0.1", port: int = 8787, app: App | None = None) -> ThreadingHTTPServer:
    jarvis_app = app or create_app()
    handler = type("BoundHandler", (JarvisHandler,), {"app": jarvis_app})
    return ThreadingHTTPServer((host, port), handler)
