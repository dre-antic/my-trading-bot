from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import db_path

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  identity_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  platform TEXT NOT NULL,
  duration TEXT NOT NULL,
  custom_seconds INTEGER,
  mode TEXT NOT NULL DEFAULT 'simple',
  usage_mode TEXT NOT NULL DEFAULT 'personal',
  status TEXT NOT NULL DEFAULT 'draft',
  checkpoint TEXT NOT NULL DEFAULT 'created',
  settings_json TEXT NOT NULL DEFAULT '{}',
  plan_json TEXT NOT NULL DEFAULT '{}',
  research_json TEXT NOT NULL DEFAULT '{}',
  script_json TEXT NOT NULL DEFAULT '{}',
  review_json TEXT NOT NULL DEFAULT '{}',
  cost_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(channel_id) REFERENCES channels(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT DEFAULT '',
  progress REAL NOT NULL DEFAULT 0,
  current_activity TEXT DEFAULT '',
  logs TEXT NOT NULL DEFAULT '',
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  pause_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  license_json TEXT NOT NULL DEFAULT '{}',
  parent_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  bible_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  reviewer TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS cost_events (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  estimated REAL NOT NULL DEFAULT 0,
  actual REAL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  label TEXT NOT NULL,
  notes TEXT DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            path = db_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(path, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.executescript(SCHEMA)
            _conn.commit()
        return _conn


def new_id(prefix: str = "") -> str:
    value = uuid.uuid4().hex[:12]
    return f"{prefix}_{value}" if prefix else value


def execute(sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
    con = connect()
    with _lock:
        cur = con.execute(sql, params)
        con.commit()
        return cur


def query(sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
    con = connect()
    with _lock:
        rows = con.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def query_one(sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def get_setting(key: str, default: str | None = None) -> str | None:
    row = query_one("SELECT value FROM settings WHERE key=?", (key,))
    if not row:
        return default
    return row["value"]


def set_setting(key: str, value: str) -> None:
    execute(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


def get_json_setting(key: str, default=None):
    raw = get_setting(key)
    if raw is None:
        return default if default is not None else {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def set_json_setting(key: str, value) -> None:
    set_setting(key, json.dumps(value))
