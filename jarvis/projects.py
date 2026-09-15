"""Project Brain — durable understanding of each project."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from .paths import workspace_root
from .storage import Store


class ProjectBrain:
    def __init__(self, store: Store) -> None:
        self.store = store

    def upsert(
        self,
        name: str,
        root_path: str,
        *,
        purpose: str = "",
        goals: list[str] | None = None,
        architecture: str = "",
        files: list[str] | None = None,
        dependencies: list[str] | None = None,
        startup: str = "",
        testing: str = "",
        current_state: str = "",
        project_id: str | None = None,
    ) -> dict[str, Any]:
        existing = self.by_path(root_path)
        pid = project_id or (existing["id"] if existing else str(uuid.uuid4()))
        now = self.store.now()
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO project_brains (
                    id, name, root_path, purpose, goals_json, architecture, files_json,
                    dependencies_json, startup, testing, current_state, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    root_path=excluded.root_path,
                    purpose=excluded.purpose,
                    goals_json=excluded.goals_json,
                    architecture=excluded.architecture,
                    files_json=excluded.files_json,
                    dependencies_json=excluded.dependencies_json,
                    startup=excluded.startup,
                    testing=excluded.testing,
                    current_state=excluded.current_state,
                    updated_at=excluded.updated_at
                """,
                (
                    pid,
                    name,
                    str(Path(root_path)),
                    purpose,
                    self.store.dumps(goals or []),
                    architecture,
                    self.store.dumps(files or []),
                    self.store.dumps(dependencies or []),
                    startup,
                    testing,
                    current_state,
                    now,
                ),
            )
        return self.get(pid)

    def record_decision(self, project_id: str, decision: str) -> None:
        brain = self.get(project_id)
        decisions = self.store.loads(
            self._raw(project_id)["decisions_json"] if False else None,
            [],
        )
        # load from row
        with self.store.connect() as conn:
            row = conn.execute("SELECT decisions_json, changelog_json FROM project_brains WHERE id = ?", (project_id,)).fetchone()
            decisions = self.store.loads(row["decisions_json"], [])
            changelog = self.store.loads(row["changelog_json"], [])
            decisions.append({"ts": self.store.now(), "decision": decision})
            changelog.append({"ts": self.store.now(), "change": decision})
            conn.execute(
                "UPDATE project_brains SET decisions_json = ?, changelog_json = ?, updated_at = ? WHERE id = ?",
                (self.store.dumps(decisions), self.store.dumps(changelog), self.store.now(), project_id),
            )
        _ = brain

    def get(self, project_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM project_brains WHERE id = ?", (project_id,)).fetchone()
            if row is None:
                raise KeyError(project_id)
            return self._inflate(row)

    def by_path(self, root_path: str) -> dict[str, Any] | None:
        with self.store.connect() as conn:
            row = conn.execute(
                "SELECT * FROM project_brains WHERE root_path = ?", (str(Path(root_path)),)
            ).fetchone()
            return self._inflate(row) if row else None

    def list(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            return [self._inflate(r) for r in conn.execute("SELECT * FROM project_brains ORDER BY updated_at DESC").fetchall()]

    def explain(self, project_id: str) -> str:
        brain = self.get(project_id)
        parts = [
            f"{brain['name']} is a project JARVIS is helping you with.",
            brain.get("purpose") or "I do not have a purpose written down yet.",
            f"It lives at {brain['root_path']}.",
        ]
        if brain.get("architecture"):
            parts.append(f"How it is built: {brain['architecture']}")
        if brain.get("current_state"):
            parts.append(f"Current state: {brain['current_state']}")
        if brain.get("startup"):
            parts.append(f"How to open it: {brain['startup']}")
        if brain.get("testing"):
            parts.append(f"How we check it: {brain['testing']}")
        return " ".join(parts)

    def discover_workspace(self) -> list[dict[str, Any]]:
        root = workspace_root()
        if not root.exists():
            return []
        found = []
        for child in sorted(root.iterdir()):
            if child.is_dir() and not child.name.startswith("."):
                files = [p.name for p in list(child.iterdir())[:40] if p.is_file()]
                brain = self.upsert(
                    child.name,
                    str(child),
                    purpose=f"Project folder named {child.name}",
                    files=files,
                    current_state="Discovered on disk.",
                )
                found.append(brain)
        return found

    def _inflate(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        for key in (
            "goals_json",
            "files_json",
            "dependencies_json",
            "providers_json",
            "models_json",
            "configuration_json",
            "issues_json",
            "fixes_json",
            "decisions_json",
            "changelog_json",
        ):
            nice = key.removesuffix("_json")
            default: Any = {} if "configuration" in key else []
            data[nice] = self.store.loads(data.pop(key), default)
        return data
