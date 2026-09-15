"""Filesystem locations. Override with JARVIS_HOME and JARVIS_WORKSPACE."""

from __future__ import annotations

import os
from pathlib import Path


def jarvis_home() -> Path:
    override = os.environ.get("JARVIS_HOME")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".jarvis"


def workspace_root() -> Path:
    override = os.environ.get("JARVIS_WORKSPACE")
    if override:
        return Path(override).expanduser().resolve()
    settings = jarvis_home() / "settings.json"
    if settings.exists():
        try:
            import json

            data = json.loads(settings.read_text(encoding="utf-8"))
            configured = data.get("workspace")
            if configured:
                return Path(configured).expanduser().resolve()
        except (OSError, ValueError):
            pass
    return Path.home() / "Projects"


def db_path() -> Path:
    return jarvis_home() / "jarvis.sqlite"


def log_dir() -> Path:
    return jarvis_home() / "logs"


def cache_dir() -> Path:
    return jarvis_home() / "cache"


def ensure_layout() -> None:
    for path in (jarvis_home(), log_dir(), cache_dir(), workspace_root()):
        path.mkdir(parents=True, exist_ok=True)
