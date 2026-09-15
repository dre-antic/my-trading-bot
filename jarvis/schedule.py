"""Scheduled missions share the same permission rules. Never a back door."""

from __future__ import annotations

import uuid
from typing import Any

from .storage import Store


class Scheduler:
    def __init__(self, store: Store) -> None:
        self.store = store

    def add(self, spec: str, objective: str) -> dict[str, Any]:
        task_id = str(uuid.uuid4())
        with self.store.connect() as conn:
            conn.execute(
                "INSERT INTO scheduled_tasks (id, spec, objective, enabled) VALUES (?, ?, ?, 1)",
                (task_id, spec, objective),
            )
        return self.get(task_id)

    def get(self, task_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM scheduled_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                raise KeyError(task_id)
            return dict(row)

    def list(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM scheduled_tasks").fetchall()]
