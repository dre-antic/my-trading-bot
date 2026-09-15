"""System Doctor — inspect the computer and explain problems in plain English."""

from __future__ import annotations

import os
import platform
import shutil
import sys
from pathlib import Path
from typing import Any

from .paths import jarvis_home, workspace_root


class SystemDoctor:
    def inspect(self) -> dict[str, Any]:
        mem = _memory()
        disk = shutil.disk_usage("/")
        issues: list[dict[str, str]] = []
        cursor = shutil.which("agent") or shutil.which("cursor-agent")
        if not cursor:
            issues.append(
                {
                    "what": "Cursor CLI is not installed",
                    "why": "JARVIS prefers talking to Cursor with the official agent command instead of clicking the editor.",
                    "how": "On the Mac, install Cursor CLI from cursor.com/docs/cli then run agent login. JARVIS works without it using the local builder.",
                    "risk": "low",
                }
            )
        if mem and mem < 7_500_000_000:
            issues.append(
                {
                    "what": "This computer has limited memory",
                    "why": "Large local AI models would freeze an 8 GB Intel Mac.",
                    "how": "JARVIS keeps heavy work optional and remote. No action needed.",
                    "risk": "info",
                }
            )
        ws = workspace_root()
        if not ws.exists():
            issues.append(
                {
                    "what": "The Projects folder is missing",
                    "why": "JARVIS keeps work in a Projects folder so it does not wander through personal files.",
                    "how": "JARVIS can create it automatically. That is a low-risk fix.",
                    "risk": "low",
                }
            )
        return {
            "os": f"{platform.system()} {platform.release()}",
            "machine": platform.machine(),
            "python": sys.version.split()[0],
            "node": _version("node"),
            "git": _version("git"),
            "homebrew": bool(shutil.which("brew")),
            "cursor_cli": cursor or "",
            "docker": bool(shutil.which("docker")),
            "browsers": [name for name in ("google-chrome", "chromium", "firefox", "safari") if shutil.which(name)],
            "disk_free_gb": round(disk.free / 1e9, 1),
            "memory_bytes": mem,
            "jarvis_home": str(jarvis_home()),
            "workspace": str(ws),
            "issues": issues,
        }

    def autofix_low_risk(self) -> list[str]:
        done = []
        ws = workspace_root()
        if not ws.exists():
            ws.mkdir(parents=True, exist_ok=True)
            done.append(f"Created project folder at {ws}")
        home = jarvis_home()
        home.mkdir(parents=True, exist_ok=True)
        (home / "logs").mkdir(exist_ok=True)
        return done


def _version(binary: str) -> str:
    path = shutil.which(binary)
    if not path:
        return ""
    try:
        import subprocess

        proc = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=5)
        return (proc.stdout or proc.stderr).splitlines()[0][:80]
    except Exception:
        return path


def _memory() -> int | None:
    try:
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, OSError, AttributeError):
        return None
