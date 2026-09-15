"""User-facing notifications. Concise. No secrets."""

from __future__ import annotations

import uuid
from typing import Any

from .secrets import redact
from .storage import Store


class Notifications:
    def __init__(self, store: Store) -> None:
        self.store = store

    def emit(self, kind: str, title: str, body: str) -> dict[str, Any]:
        note_id = str(uuid.uuid4())
        with self.store.connect() as conn:
            conn.execute(
                "INSERT INTO notifications (id, ts, kind, title, body, read) VALUES (?, ?, ?, ?, ?, 0)",
                (note_id, self.store.now(), kind, redact(title), redact(body)),
            )
        return {"id": note_id, "kind": kind, "title": title, "body": body}

    def list(self, unread_only: bool = False) -> list[dict[str, Any]]:
        sql = "SELECT * FROM notifications"
        if unread_only:
            sql += " WHERE read = 0"
        sql += " ORDER BY ts DESC LIMIT 50"
        with self.store.connect() as conn:
            return [dict(r) for r in conn.execute(sql).fetchall()]

    def mark_read(self, note_id: str) -> None:
        with self.store.connect() as conn:
            conn.execute("UPDATE notifications SET read = 1 WHERE id = ?", (note_id,))
