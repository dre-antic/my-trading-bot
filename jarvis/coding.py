"""Local $0 coding worker. Creates real files and tests — never a fake 'done'."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from .paths import workspace_root
from .security import SecurityEngine

TASKLIST_APP_PY = '''"""Simple task-list application with JSON persistence."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import uuid4


@dataclass
class Task:
    id: str
    title: str
    done: bool = False
    notes: str = ""


class TaskStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write([])

    def _read(self) -> list[Task]:
        raw = json.loads(self.path.read_text(encoding="utf-8") or "[]")
        return [Task(**item) for item in raw]

    def _write(self, tasks: list[Task]) -> None:
        self.path.write_text(json.dumps([asdict(t) for t in tasks], indent=2), encoding="utf-8")

    def list(self) -> list[Task]:
        return self._read()

    def create(self, title: str, notes: str = "") -> Task:
        tasks = self._read()
        task = Task(id=str(uuid4()), title=title.strip(), notes=notes)
        if not task.title:
            raise ValueError("A task needs a title.")
        tasks.append(task)
        self._write(tasks)
        return task

    def update(self, task_id: str, title: str | None = None, done: bool | None = None, notes: str | None = None) -> Task:
        tasks = self._read()
        for task in tasks:
            if task.id == task_id:
                if title is not None:
                    task.title = title.strip()
                if done is not None:
                    task.done = bool(done)
                if notes is not None:
                    task.notes = notes
                self._write(tasks)
                return task
        raise KeyError(task_id)

    def delete(self, task_id: str) -> None:
        tasks = [t for t in self._read() if t.id != task_id]
        self._write(tasks)
'''

TASKLIST_SERVER_PY = '''"""Local web UI for the task list. No internet required."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .app import TaskStore

ROOT = Path(__file__).resolve().parent
STORE = TaskStore(ROOT / "data" / "tasks.json")
INDEX = (ROOT / "static" / "index.html").read_text(encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return

    def _json(self, code: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            data = INDEX.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/api/tasks":
            self._json(200, [t.__dict__ for t in STORE.list()])
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = json.loads(self.rfile.read(length) or b"{}")
        path = urlparse(self.path).path
        if path == "/api/tasks":
            task = STORE.create(raw.get("title", ""), raw.get("notes", ""))
            self._json(201, task.__dict__)
            return
        self._json(404, {"error": "not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = json.loads(self.rfile.read(length) or b"{}")
        task_id = urlparse(self.path).path.rsplit("/", 1)[-1]
        try:
            task = STORE.update(task_id, title=raw.get("title"), done=raw.get("done"), notes=raw.get("notes"))
        except KeyError:
            self._json(404, {"error": "missing"})
            return
        self._json(200, task.__dict__)

    def do_DELETE(self) -> None:  # noqa: N802
        task_id = urlparse(self.path).path.rsplit("/", 1)[-1]
        STORE.delete(task_id)
        self._json(204, {})


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    serve()
'''

TASKLIST_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Task List</title>
  <style>
    body { font-family: Georgia, serif; max-width: 40rem; margin: 3rem auto; color: #1b1b1b; background: #f7f4ee; }
    h1 { font-weight: 500; }
    form { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
    input { flex: 1; padding: .6rem .8rem; font-size: 1rem; }
    button { padding: .6rem 1rem; cursor: pointer; }
    li { display: flex; gap: .6rem; align-items: center; padding: .4rem 0; }
    li.done span { text-decoration: line-through; opacity: .6; }
  </style>
</head>
<body>
  <h1>Task list</h1>
  <form id="new-task">
    <input id="title" placeholder="What needs doing?" required>
    <button type="submit">Add</button>
  </form>
  <ul id="tasks"></ul>
  <script>
    async function load() {
      const tasks = await (await fetch('/api/tasks')).json();
      const ul = document.getElementById('tasks');
      ul.innerHTML = '';
      for (const task of tasks) {
        const li = document.createElement('li');
        li.className = task.done ? 'done' : '';
        li.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''} data-id="${task.id}">
          <span contenteditable="true" data-id="${task.id}">${task.title}</span>
          <button data-del="${task.id}">Delete</button>`;
        ul.appendChild(li);
      }
    }
    document.getElementById('new-task').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value;
      await fetch('/api/tasks', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title})});
      document.getElementById('title').value = '';
      load();
    });
    document.getElementById('tasks').addEventListener('change', async (e) => {
      if (e.target.dataset.id && e.target.type === 'checkbox') {
        await fetch('/api/tasks/' + e.target.dataset.id, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({done: e.target.checked})});
        load();
      }
    });
    document.getElementById('tasks').addEventListener('focusout', async (e) => {
      if (e.target.dataset.id && e.target.tagName === 'SPAN') {
        await fetch('/api/tasks/' + e.target.dataset.id, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title: e.target.textContent})});
      }
    });
    document.getElementById('tasks').addEventListener('click', async (e) => {
      if (e.target.dataset.del) {
        await fetch('/api/tasks/' + e.target.dataset.del, {method:'DELETE'});
        load();
      }
    });
    load();
  </script>
</body>
</html>
"""

TASKLIST_TEST = '''from pathlib import Path
from tasklist.app import TaskStore


def test_create_edit_persist_delete(tmp_path: Path) -> None:
    store = TaskStore(tmp_path / "tasks.json")
    task = store.create("Buy milk")
    assert task.title == "Buy milk"
    store.update(task.id, title="Buy oat milk", done=True)
    again = TaskStore(tmp_path / "tasks.json")
    items = again.list()
    assert len(items) == 1
    assert items[0].title == "Buy oat milk"
    assert items[0].done is True
    again.delete(items[0].id)
    assert again.list() == []
'''

TASKLIST_INIT = 'from .app import TaskStore, Task\n'
TASKLIST_README = """# Task list

A simple list you can open in a browser.

## Open it

```
python3 -m tasklist.server
```

Then visit http://127.0.0.1:8765

## Check it

```
python3 -m pytest tests -q
```
"""


class LocalCodingAgent:
    def __init__(self, security: SecurityEngine) -> None:
        self.security = security

    def slug(self, objective: str) -> str:
        words = re.findall(r"[a-z0-9]+", objective.lower())
        slug = "-".join(words[:6]) or "project"
        return slug[:40]

    def project_dir(self, objective: str) -> Path:
        root = workspace_root()
        root.mkdir(parents=True, exist_ok=True)
        path = root / self.slug(objective)
        return path

    def build(self, objective: str) -> dict[str, Any]:
        lowered = objective.lower()
        dest = self.project_dir(objective)
        check = self.security.check_path_access(str(dest), "create_project_file")
        if not check.allowed and not str(dest).startswith(str(workspace_root())):
            return {"ok": False, "error": check.reason, "path": str(dest)}
        dest.mkdir(parents=True, exist_ok=True)
        if "task" in lowered and ("list" in lowered or "todo" in lowered):
            return self._task_list(dest, objective)
        return self._generic(dest, objective)

    def _task_list(self, dest: Path, objective: str) -> dict[str, Any]:
        pkg = dest / "tasklist"
        static = pkg / "static"
        tests = dest / "tests"
        pkg.mkdir(exist_ok=True)
        static.mkdir(exist_ok=True)
        tests.mkdir(exist_ok=True)
        (pkg / "__init__.py").write_text(TASKLIST_INIT, encoding="utf-8")
        (pkg / "app.py").write_text(TASKLIST_APP_PY, encoding="utf-8")
        (pkg / "server.py").write_text(TASKLIST_SERVER_PY, encoding="utf-8")
        (static / "index.html").write_text(TASKLIST_HTML, encoding="utf-8")
        (tests / "test_tasks.py").write_text(TASKLIST_TEST, encoding="utf-8")
        (dest / "README.md").write_text(TASKLIST_README, encoding="utf-8")
        (dest / "pyproject.toml").write_text(
            '[project]\nname = "tasklist"\nversion = "0.1.0"\nrequires-python = ">=3.11"\n',
            encoding="utf-8",
        )
        test_result = self.run_tests(dest)
        return {
            "ok": test_result["ok"],
            "worker": "local-coding",
            "path": str(dest),
            "files": sorted(str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file()),
            "tests": test_result,
            "launch": f"python3 -m tasklist.server (cwd {dest})",
            "objective": objective,
        }

    def _generic(self, dest: Path, objective: str) -> dict[str, Any]:
        (dest / "README.md").write_text(f"# {dest.name}\n\n{objective}\n", encoding="utf-8")
        (dest / "app.py").write_text(
            'def main() -> str:\n    return "ok"\n\nif __name__ == "__main__":\n    print(main())\n',
            encoding="utf-8",
        )
        tests = dest / "tests"
        tests.mkdir(exist_ok=True)
        (tests / "test_app.py").write_text("from app import main\n\ndef test_main():\n    assert main() == 'ok'\n", encoding="utf-8")
        test_result = self.run_tests(dest)
        return {
            "ok": test_result["ok"],
            "worker": "local-coding",
            "path": str(dest),
            "files": sorted(str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file()),
            "tests": test_result,
            "objective": objective,
        }

    def run_tests(self, dest: Path) -> dict[str, Any]:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests", "-q"],
            cwd=dest,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-2000:],
        }

    def inspect(self, dest: Path) -> dict[str, Any]:
        files = []
        for path in dest.rglob("*"):
            if path.is_file():
                files.append({"path": str(path.relative_to(dest)), "bytes": path.stat().st_size})
        return {"path": str(dest), "files": files}
