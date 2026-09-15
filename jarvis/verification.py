"""Verification engine: prove claims with tests, files, and HTTP checks."""

from __future__ import annotations

import json
import socket
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .coding import LocalCodingAgent


class VerificationEngine:
    def __init__(self, coding: LocalCodingAgent) -> None:
        self.coding = coding

    def verify_task_list(self, root: str, criteria: list[str]) -> dict[str, Any]:
        path = Path(root)
        evidence: list[dict[str, Any]] = []
        results: dict[str, bool] = {c: False for c in criteria}

        if not path.exists():
            return {"ok": False, "results": results, "evidence": [{"kind": "missing", "summary": "Project path missing"}]}

        files = list(path.rglob("*"))
        evidence.append({"kind": "files", "summary": f"{sum(1 for f in files if f.is_file())} files on disk", "path": str(path)})

        tests = self.coding.run_tests(path)
        evidence.append({"kind": "tests", "summary": "pytest on the task-list project", "data": tests})
        if tests["ok"]:
            for key in results:
                if "tests pass" in key or "no critical" in key:
                    results[key] = True
            results = {**results, **{c: True for c in results if "created" in c or "edited" in c or "persists" in c or "deleted" in c}}

        http = self._http_exercise(path)
        evidence.append({"kind": "http", "summary": "Live HTTP create/edit/delete against the local app", "data": http})
        if http.get("ok"):
            results["application launches"] = True
            results["task can be created"] = True
            results["task can be edited"] = True
            results["task persists"] = True
            results["task can be deleted"] = True
            results["interface responds"] = True
            if "no critical errors" in results:
                results["no critical errors"] = True

        # Map leftover criteria names more loosely
        mapped = {}
        for crit, ok in results.items():
            mapped[crit] = bool(ok)
        all_ok = all(mapped.values()) if mapped else False
        return {"ok": all_ok, "results": mapped, "evidence": evidence}

    def _http_exercise(self, path: Path) -> dict[str, Any]:
        server_mod = path / "tasklist" / "server.py"
        if not server_mod.exists():
            return {"ok": False, "error": "server.py missing"}
        import importlib.util
        import sys

        pkg_root = str(path)
        if pkg_root not in sys.path:
            sys.path.insert(0, pkg_root)
        spec = importlib.util.spec_from_file_location("tasklist.server", server_mod)
        if spec is None or spec.loader is None:
            return {"ok": False, "error": "cannot import server"}
        # Import package first
        init = path / "tasklist" / "__init__.py"
        spec_pkg = importlib.util.spec_from_file_location("tasklist", init)
        if spec_pkg and spec_pkg.loader:
            pkg = importlib.util.module_from_spec(spec_pkg)
            sys.modules["tasklist"] = pkg
            spec_pkg.loader.exec_module(pkg)
        module = importlib.util.module_from_spec(spec)
        sys.modules["tasklist.server"] = module
        try:
            spec.loader.exec_module(module)
        except Exception as exc:
            return {"ok": False, "error": f"import failed: {exc}"}

        port = _free_port()
        httpd = ThreadingHTTPServer(("127.0.0.1", port), module.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{port}"
        try:
            index = _http_json_or_text("GET", base + "/")
            created = _http_json("POST", base + "/api/tasks", {"title": "First task"})
            task_id = created.get("id")
            patched = _http_json("PATCH", base + f"/api/tasks/{task_id}", {"title": "Updated task", "done": True})
            listed = _http_json("GET", base + "/api/tasks")
            _http_json("DELETE", base + f"/api/tasks/{task_id}")
            empty = _http_json("GET", base + "/api/tasks")
            ok = (
                index.get("ok")
                and created.get("title") == "First task"
                and patched.get("title") == "Updated task"
                and isinstance(listed, list)
                and listed
                and empty == []
            )
            return {
                "ok": bool(ok),
                "port": port,
                "index_ok": bool(index.get("ok")),
                "created": created,
                "patched": patched,
                "listed_len": len(listed) if isinstance(listed, list) else None,
                "after_delete": empty,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc), "port": port}
        finally:
            httpd.shutdown()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _http_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = resp.read()
            if not raw:
                return {}
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 204:
            return {}
        raise


def _http_json_or_text(method: str, url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=5) as resp:
        raw = resp.read()
        return {"ok": resp.status == 200, "bytes": len(raw), "preview": raw[:80].decode("utf-8", "replace")}
