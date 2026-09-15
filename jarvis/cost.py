"""Cost manager. Default automatic spending is $0."""

from __future__ import annotations

from dataclasses import dataclass

from .storage import Store


@dataclass
class SpendDecision:
    allowed: bool
    estimated: float
    reason: str
    requires_approval: bool


class CostManager:
    AUTO_LIMIT = 0.0

    def __init__(self, store: Store) -> None:
        self.store = store

    def evaluate(self, provider: str, operation: str, estimated: float, approved: bool = False) -> SpendDecision:
        if estimated <= 0:
            self._write(provider, operation, 0, 0, approved=True, blocked=False, reason="zero cost")
            return SpendDecision(True, 0.0, "No cost.", False)
        if approved:
            self._write(provider, operation, estimated, 0, approved=True, blocked=False, reason="user approved")
            return SpendDecision(True, estimated, "Explicitly approved.", False)
        self._write(
            provider,
            operation,
            estimated,
            0,
            approved=False,
            blocked=True,
            reason="automatic spending is $0",
        )
        return SpendDecision(
            False,
            estimated,
            "STOP. Paid service requires explicit approval. Automatic spending is $0.",
            True,
        )

    def record_actual(self, provider: str, operation: str, actual: float) -> None:
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO cost_events (ts, provider, operation, estimated, actual, approved, blocked, reason)
                   VALUES (?, ?, ?, ?, ?, 1, 0, ?)""",
                (self.store.now(), provider, operation, actual, actual, "recorded"),
            )

    def totals(self) -> dict[str, float]:
        with self.store.connect() as conn:
            row = conn.execute(
                "SELECT COALESCE(SUM(actual),0) AS actual, COALESCE(SUM(estimated),0) AS estimated FROM cost_events WHERE blocked = 0"
            ).fetchone()
            blocked = conn.execute(
                "SELECT COUNT(*) AS n FROM cost_events WHERE blocked = 1"
            ).fetchone()["n"]
        return {
            "actual": float(row["actual"]),
            "estimated_approved": float(row["estimated"]),
            "blocked_events": float(blocked),
            "auto_limit": self.AUTO_LIMIT,
        }

    def _write(
        self,
        provider: str,
        operation: str,
        estimated: float,
        actual: float,
        approved: bool,
        blocked: bool,
        reason: str,
    ) -> None:
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO cost_events (ts, provider, operation, estimated, actual, approved, blocked, reason)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    self.store.now(),
                    provider,
                    operation,
                    estimated,
                    actual,
                    1 if approved else 0,
                    1 if blocked else 0,
                    reason,
                ),
            )
