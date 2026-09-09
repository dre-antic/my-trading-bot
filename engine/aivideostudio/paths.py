from __future__ import annotations

import os
import sys
from pathlib import Path


def _macos_app_support() -> Path:
    return Path.home() / "Library" / "Application Support" / "AI Video Studio"


def _linux_data() -> Path:
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "ai-video-studio"
    return Path.home() / ".local" / "share" / "ai-video-studio"


def app_data_dir() -> Path:
    override = os.environ.get("AIVS_DATA_DIR")
    if override:
        path = Path(override)
        path.mkdir(parents=True, exist_ok=True)
        return path
    if sys.platform == "darwin":
        path = _macos_app_support()
    elif sys.platform == "win32":
        path = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "AI Video Studio"
    else:
        path = _linux_data()
    path.mkdir(parents=True, exist_ok=True)
    return path


def repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").exists() and (parent / "resources").exists():
            return parent
    return here.parents[2]


def resources_dir() -> Path:
    env = os.environ.get("AIVS_RESOURCES")
    if env:
        return Path(env)
    bundled = Path(__file__).resolve().parent / "resources"
    if bundled.exists():
        return bundled
    return repo_root() / "resources"


def web_dir() -> Path:
    return Path(__file__).resolve().parent / "web"


def db_path() -> Path:
    return app_data_dir() / "studio.sqlite"


def logs_dir() -> Path:
    path = app_data_dir() / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def projects_dir() -> Path:
    path = app_data_dir() / "projects"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cache_dir() -> Path:
    path = app_data_dir() / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_dir(project_id: str) -> Path:
    path = projects_dir() / project_id
    for sub in ("research", "script", "scenes", "visuals", "audio", "captions", "thumbnails", "renders", "versions", "logs"):
        (path / sub).mkdir(parents=True, exist_ok=True)
    return path
