"""System Doctor — inspect the computer and explain problems in plain English."""

from __future__ import annotations

from typing import Any

from .paths import jarvis_home, workspace_root
from .runtime import LocalMacRuntime


class SystemDoctor:
    def __init__(self, runtime: LocalMacRuntime | None = None) -> None:
        self.runtime = runtime or LocalMacRuntime()

    def inspect(self) -> dict[str, Any]:
        inv = self.runtime.inventory()
        issues: list[dict[str, str]] = []
        python = inv.get("python") or {}
        if python.get("ok_for_jarvis") is False:
            issues.append(
                {
                    "what": "This Python version is a poor fit",
                    "why": "Homebrew Python 3.14 can hang compiling extra packages on this Intel Mac.",
                    "how": "Use /usr/local/bin/python3.11. See Installation.",
                    "risk": "low",
                }
            )
        if not (inv.get("cursor") or {}).get("cli"):
            issues.append(
                {
                    "what": "Cursor CLI is not installed",
                    "why": "JARVIS prefers talking to Cursor with the official agent command instead of clicking the editor.",
                    "how": "On the Mac, install Cursor CLI from cursor.com/docs/cli then run agent login. JARVIS works without it using the local builder.",
                    "risk": "low",
                }
            )
        mem = inv.get("memory_bytes")
        if mem and mem < 7_500_000_000:
            issues.append(
                {
                    "what": "This computer has limited memory",
                    "why": "Large local AI models would freeze an 8 GB Intel Mac.",
                    "how": "JARVIS keeps heavy work optional and remote. No action needed.",
                    "risk": "info",
                }
            )
        if inv.get("docker"):
            issues.append(
                {
                    "what": "Docker is present",
                    "why": "JARVIS does not need Docker. It will not start it for you.",
                    "how": "Leave it closed to save RAM.",
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
        inv["issues"] = issues
        inv["planes"] = {
            "local_mac": True,
            "cloud_ai": self.runtime.cloud_ai_status()["available"],
        }
        return inv

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
