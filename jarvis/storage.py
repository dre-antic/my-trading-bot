"""SQLite persistence. Local-only. No Redis/Postgres/Kubernetes."""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .paths import db_path, ensure_layout
from .secrets import redact

SCHEMA = """
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    objective TEXT NOT NULL,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    plan_json TEXT NOT NULL DEFAULT '{}',
    criteria_json TEXT NOT NULL DEFAULT '[]',
    tasks_json TEXT NOT NULL DEFAULT '[]',
    tools_json TEXT NOT NULL DEFAULT '[]',
    agents_json TEXT NOT NULL DEFAULT '[]',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    evidence_json TEXT NOT NULL DEFAULT '[]',
    errors_json TEXT NOT NULL DEFAULT '[]',
    recovery_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT NOT NULL DEFAULT '{}',
    project_id TEXT,
    checkpoint_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    mission_id TEXT,
    agent TEXT,
    tool TEXT,
    action TEXT NOT NULL,
    target TEXT,
    risk TEXT,
    approval TEXT,
    result TEXT
);

CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    project_id TEXT,
    mission_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_brains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT '',
    goals_json TEXT NOT NULL DEFAULT '[]',
    architecture TEXT NOT NULL DEFAULT '',
    files_json TEXT NOT NULL DEFAULT '[]',
    dependencies_json TEXT NOT NULL DEFAULT '[]',
    startup TEXT NOT NULL DEFAULT '',
    testing TEXT NOT NULL DEFAULT '',
    providers_json TEXT NOT NULL DEFAULT '[]',
    models_json TEXT NOT NULL DEFAULT '[]',
    configuration_json TEXT NOT NULL DEFAULT '{}',
    issues_json TEXT NOT NULL DEFAULT '[]',
    fixes_json TEXT NOT NULL DEFAULT '[]',
    decisions_json TEXT NOT NULL DEFAULT '[]',
    changelog_json TEXT NOT NULL DEFAULT '[]',
    current_state TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    mission_id TEXT,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    why TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    cost TEXT NOT NULL DEFAULT '$0',
    risk TEXT NOT NULL,
    reversibility TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    decided_at TEXT
);

CREATE TABLE IF NOT EXISTS cost_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    estimated REAL NOT NULL DEFAULT 0,
    actual REAL NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL DEFAULT 0,
    blocked INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    identity TEXT NOT NULL,
    source TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    repository TEXT NOT NULL DEFAULT '',
    capabilities_json TEXT NOT NULL DEFAULT '[]',
    filesystem_access TEXT NOT NULL DEFAULT 'none',
    network_access TEXT NOT NULL DEFAULT 'none',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    authentication TEXT NOT NULL DEFAULT 'none',
    risk TEXT NOT NULL,
    trust_status TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    spec TEXT NOT NULL,
    objective TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    next_run TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credential_meta (
    provider TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '[]',
    last_success TEXT,
    keyring_ref TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_observations (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    mission_id TEXT
);

CREATE TABLE IF NOT EXISTS learning_proposals (
    id TEXT PRIMARY KEY,
    observation_id TEXT,
    ts TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    protected INTEGER NOT NULL DEFAULT 0,
    immutable INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    applied INTEGER NOT NULL DEFAULT 0
);
"""


class Store:
    def __init__(self, path: Path | None = None) -> None:
        ensure_layout()
        self.path = path or db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init()

    def _init(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            conn = sqlite3.connect(self.path, timeout=30)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def dumps(self, value: Any) -> str:
        return json.dumps(value, ensure_ascii=True)

    def loads(self, raw: str | None, default: Any) -> Any:
        if not raw:
            return default
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return default

    def now(self) -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()

    def insert_audit(self, **fields: Any) -> None:
        safe = {k: redact(str(v)) if v is not None else None for k, v in fields.items()}
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO audit_log (ts, mission_id, agent, tool, action, target, risk, approval, result)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    self.now(),
                    safe.get("mission_id"),
                    safe.get("agent"),
                    safe.get("tool"),
                    safe.get("action") or "unknown",
                    safe.get("target"),
                    safe.get("risk"),
                    safe.get("approval"),
                    safe.get("result"),
                ),
            )
