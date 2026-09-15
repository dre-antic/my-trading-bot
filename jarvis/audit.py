"""Human-readable audit log. Secrets are redacted before write."""

from __future__ import annotations

from typing import Any

from .secrets import redact
from .storage import Store


class AuditLog:
    def __init__(self, store: Store) -> None:
        self.store = store

    def record(
        self,
        action: str,
        *,
        mission_id: str | None = None,
        agent: str | None = None,
        tool: str | None = None,
        target: str | None = None,
        risk: str | None = None,
        approval: str | None = None,
        result: str | None = None,
    ) -> None:
        self.store.insert_audit(
            mission_id=mission_id,
            agent=agent,
            tool=tool,
            action=action,
            target=target,
            risk=risk,
            approval=approval,
            result=result,
        )

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            items = [dict(r) for r in rows]
        for item in items:
            for key, value in list(item.items()):
                if isinstance(value, str):
                    item[key] = redact(value)
        return items

    def contains_secret_like(self) -> bool:
        from .secrets import looks_like_secret

        for row in self.recent(1000):
            blob = " ".join(str(v) for v in row.values() if v is not None)
            if looks_like_secret(blob) and "[REDACTED]" not in blob:
                # patterns already redacted at write; leftover raw secrets are a failure
                if "sk-" in blob or "BEGIN PRIVATE KEY" in blob or "ghp_" in blob:
                    return True
        return False
