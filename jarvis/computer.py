"""macOS computer controller. Honest disconnected state on Linux."""

from __future__ import annotations

import platform
import shutil
import subprocess
from typing import Any

from .permissions import PermissionEngine
from .types import RiskLevel


class ComputerAgent:
    def __init__(self, permissions: PermissionEngine) -> None:
        self.permissions = permissions
        self.platform = platform.system()

    def status(self) -> dict[str, Any]:
        if self.platform == "Darwin":
            return {
                "connected": True,
                "platform": "macOS",
                "methods": ["official API", "osascript", "open"],
                "detail": "Mac automation uses AppleScript / `open` first, never coordinate clicking.",
            }
        return {
            "connected": False,
            "platform": self.platform,
            "methods": [],
            "detail": "This computer is not macOS. Mac app control is disconnected. Local processes can still be launched for tests.",
        }

    def list_applications(self) -> dict[str, Any]:
        if self.platform != "Darwin":
            return {
                "ok": True,
                "applications": [],
                "disconnected": True,
                "detail": "Application listing is a Mac feature. This computer is not macOS.",
            }
        names: list[str] = []
        from pathlib import Path

        for root in (Path("/Applications"), Path.home() / "Applications"):
            if root.is_dir():
                names.extend(p.stem for p in sorted(root.glob("*.app")))
        return {"ok": True, "applications": names, "disconnected": False}

    def launch_app(self, name: str, mission_id: str | None = None) -> dict[str, Any]:
        verdict = self.permissions.evaluate(
            "launch_permitted_app",
            target=name,
            why="Open an application to inspect or test it.",
            mission_id=mission_id,
        )
        if not verdict.allowed and verdict.needs_approval:
            return {"ok": False, "needs_approval": True, "approval_id": verdict.approval_id, "reason": verdict.reason}
        if self.platform == "Darwin":
            try:
                subprocess.run(["open", "-a", name], check=False, timeout=10)
                return {"ok": True, "method": "open -a"}
            except (OSError, subprocess.TimeoutExpired) as exc:
                return {"ok": False, "error": str(exc)}
        return {
            "ok": False,
            "disconnected": True,
            "detail": f"Cannot control macOS apps from {self.platform}.",
        }

    def applescript(self, script: str) -> dict[str, Any]:
        if self.platform != "Darwin" or not shutil.which("osascript"):
            return {"ok": False, "disconnected": True, "detail": "osascript is not available."}
        if any(word in script.lower() for word in ("password", "keychain", "sudo")):
            return {"ok": False, "reason": "High-risk AppleScript is blocked.", "risk": RiskLevel.RED.value}
        try:
            proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=15)
            return {"ok": proc.returncode == 0, "stdout": proc.stdout, "stderr": proc.stderr}
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "error": str(exc)}

    def screenshot(self) -> dict[str, Any]:
        if self.platform != "Darwin":
            return {"ok": False, "disconnected": True, "detail": "Screen capture for Observe mode is a Mac feature."}
        return {"ok": False, "disconnected": True, "detail": "Screenshot requested — implement via screencapture on the Mac."}
