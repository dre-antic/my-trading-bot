"""Persistent, searchable, editable memory. Secrets are refused."""

from __future__ import annotations

import uuid
from typing import Any

from .secrets import looks_like_secret
from .storage import Store
from .types import MemoryKind


class MemoryDenied(ValueError):
    pass


class MemorySystem:
    def __init__(self, store: Store) -> None:
        self.store = store

    def add(
        self,
        kind: MemoryKind,
        title: str,
        body: str,
        *,
        project_id: str | None = None,
        mission_id: str | None = None,
    ) -> dict[str, Any]:
        if looks_like_secret(title) or looks_like_secret(body):
            raise MemoryDenied("Refusing to store secrets as memory.")
        memory_id = str(uuid.uuid4())
        now = self.store.now()
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO memory (id, kind, project_id, mission_id, title, body, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (memory_id, kind.value, project_id, mission_id, title, body, now, now),
            )
        return self.get(memory_id)

    def get(self, memory_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM memory WHERE id = ?", (memory_id,)).fetchone()
            if row is None:
                raise KeyError(memory_id)
            return dict(row)

    def update(self, memory_id: str, title: str | None = None, body: str | None = None) -> dict[str, Any]:
        current = self.get(memory_id)
        title = title if title is not None else current["title"]
        body = body if body is not None else current["body"]
        if looks_like_secret(title) or looks_like_secret(body):
            raise MemoryDenied("Refusing to store secrets as memory.")
        with self.store.connect() as conn:
            conn.execute(
                "UPDATE memory SET title = ?, body = ?, updated_at = ? WHERE id = ?",
                (title, body, self.store.now(), memory_id),
            )
        return self.get(memory_id)

    def delete(self, memory_id: str) -> None:
        with self.store.connect() as conn:
            conn.execute("DELETE FROM memory WHERE id = ?", (memory_id,))

    def search(self, query: str, kind: MemoryKind | None = None) -> list[dict[str, Any]]:
        like = f"%{query}%"
        with self.store.connect() as conn:
            if kind:
                rows = conn.execute(
                    """SELECT * FROM memory WHERE kind = ? AND (title LIKE ? OR body LIKE ?)
                       ORDER BY updated_at DESC""",
                    (kind.value, like, like),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM memory WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC",
                    (like, like),
                ).fetchall()
            return [dict(r) for r in rows]

    def list(self, kind: MemoryKind | None = None) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            if kind:
                rows = conn.execute(
                    "SELECT * FROM memory WHERE kind = ? ORDER BY updated_at DESC", (kind.value,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM memory ORDER BY updated_at DESC").fetchall()
            return [dict(r) for r in rows]
