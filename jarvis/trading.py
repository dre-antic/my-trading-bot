"""Trading safety. Analysis is allowed. Execution is never automatic."""

from __future__ import annotations

from typing import Any

from .permissions import PermissionEngine


class TradingGuard:
    def __init__(self, permissions: PermissionEngine) -> None:
        self.permissions = permissions

    def analyze(self, notes: str) -> dict[str, Any]:
        return {
            "ok": True,
            "analysis": notes,
            "executed": False,
            "note": "JARVIS may research and explain. It will not place a trade by itself.",
        }

    def execute(self, order: dict[str, Any], mission_id: str | None = None) -> dict[str, Any]:
        verdict = self.permissions.evaluate(
            "trading_execute",
            target=str(order),
            why="Place a real financial order.",
            cost="unknown / real money",
            data=order,
            mission_id=mission_id,
            reversibility="Often not reversible",
        )
        return {
            "ok": False,
            "executed": False,
            "needs_approval": True,
            "approval_id": verdict.approval_id,
            "reason": verdict.reason,
        }
