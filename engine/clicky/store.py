from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from clicky.engine import Book


def default_db_path() -> Path:
    path = Path.home() / ".clicky" / "clicky.sqlite"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


class Store:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or default_db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init(self) -> None:
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            connection.commit()

    def load_book(self) -> Book:
        with self._connect() as connection:
            row = connection.execute("SELECT value FROM kv WHERE key = 'book'").fetchone()
        if not row:
            return Book()
        return Book.from_state(json.loads(row["value"]))

    def save_book(self, book: Book) -> None:
        payload = json.dumps(book.to_state())
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO kv(key, value) VALUES('book', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (payload,),
            )
            connection.commit()
