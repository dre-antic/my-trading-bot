"""Local vs remote execution choice. Never pick a paid provider to save a failure."""

from __future__ import annotations

from .cost import CostManager
from .types import ExecutionTarget, RouteDecision


class ExecutionRouter:
    def __init__(self, cost: CostManager, ram_bytes: int | None = None) -> None:
        self.cost = cost
        self.ram_bytes = ram_bytes

    def choose(self, route: RouteDecision, paid_approved: bool = False) -> ExecutionTarget:
        if route.execution_target == ExecutionTarget.REMOTE:
            spend = self.cost.evaluate("remote", route.intent, 0.0 if not paid_approved else 0.0)
            if route.intent == "research":
                return ExecutionTarget.REMOTE
        if self.ram_bytes is not None and self.ram_bytes < 8_000_000_000:
            if route.intent == "coding":
                return ExecutionTarget.HYBRID
        return route.execution_target
