"""MCP registry. Unknown servers are DENIED. Descriptions are not authorization."""

from __future__ import annotations

from typing import Any

from .security import SecurityEngine
from .storage import Store
from .types import RiskLevel


class McpRegistry:
    def __init__(self, store: Store, security: SecurityEngine) -> None:
        self.store = store
        self.security = security
        self._seed_builtin()

    def _seed_builtin(self) -> None:
        with self.store.connect() as conn:
            existing = conn.execute("SELECT COUNT(*) AS n FROM mcp_servers").fetchone()["n"]
            if existing:
                return
            conn.execute(
                """INSERT INTO mcp_servers (
                    id, identity, source, version, repository, capabilities_json,
                    filesystem_access, network_access, permissions_json, authentication,
                    risk, trust_status, pinned
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    "none-builtin",
                    "No MCP servers enabled by default",
                    "jarvis",
                    "0",
                    "",
                    "[]",
                    "none",
                    "none",
                    "[]",
                    "none",
                    RiskLevel.GREEN.value,
                    "trusted",
                    1,
                ),
            )

    def connect(self, identity: str, source: str = "", claimed_capabilities: list[str] | None = None) -> dict[str, Any]:
        known = self.find(identity)
        trusted = bool(known and known["trust_status"] == "trusted")
        decision = self.security.check_mcp(identity, known=bool(known), trusted=trusted)
        if not decision.allowed:
            return {
                "allowed": False,
                "identity": identity,
                "source": source,
                "reason": decision.reason,
                "claimed_capabilities": claimed_capabilities or [],
                "note": "MCP descriptions are not authorization.",
            }
        return {"allowed": True, "identity": identity, "server": known}

    def find(self, identity: str) -> dict[str, Any] | None:
        with self.store.connect() as conn:
            row = conn.execute(
                "SELECT * FROM mcp_servers WHERE id = ? OR identity = ?",
                (identity, identity),
            ).fetchone()
            return dict(row) if row else None

    def list(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM mcp_servers").fetchall()]

    def trust(
        self,
        identity: str,
        source: str,
        version: str,
        repository: str,
        capabilities: list[str],
        filesystem_access: str,
        network_access: str,
        risk: str,
    ) -> None:
        """Only called after explicit user review — never from MCP self-description."""
        with self.store.connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO mcp_servers (
                    id, identity, source, version, repository, capabilities_json,
                    filesystem_access, network_access, permissions_json, authentication,
                    risk, trust_status, pinned
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    identity,
                    identity,
                    source,
                    version,
                    repository,
                    self.store.dumps(capabilities),
                    filesystem_access,
                    network_access,
                    self.store.dumps([]),
                    "none",
                    risk,
                    "trusted",
                    1,
                ),
            )
