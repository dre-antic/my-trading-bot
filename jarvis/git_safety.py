"""Git safety: inspect/commit locally; never auto push/publish/merge/release."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from .security import SecurityEngine


class GitSafety:
    def __init__(self, security: SecurityEngine) -> None:
        self.security = security

    def inspect(self, cwd: str) -> dict[str, Any]:
        return {
            "status": _git(["status", "--porcelain"], cwd),
            "branch": _git(["rev-parse", "--abbrev-ref", "HEAD"], cwd),
            "diff": _git(["diff", "--stat"], cwd),
        }

    def commit(self, cwd: str, message: str) -> dict[str, Any]:
        add = _git(["add", "-A"], cwd)
        commit = _git(["commit", "-m", message], cwd)
        return {"add": add, "commit": commit}

    def request_publish(self, action: str) -> dict[str, Any]:
        decision = self.security.check_git_publish(action)
        return {
            "allowed": decision.allowed,
            "reason": decision.reason,
            "requires_confirmation": decision.require_confirmation,
            "action": action,
        }


def _git(args: list[str], cwd: str) -> dict[str, Any]:
    try:
        proc = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=20)
        return {"ok": proc.returncode == 0, "stdout": proc.stdout[-4000:], "stderr": proc.stderr[-1000:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "error": str(exc)}
