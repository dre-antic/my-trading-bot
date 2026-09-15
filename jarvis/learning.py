"""Self-learning storage: observe → propose → ask.

Never silently changes spending or security policy. Protected proposals
stay proposed until the user accepts. Spend/security proposals are
immutable: even an accept is refused. Coding policy stays Cursor ACP/CLI,
not Computer Use.
"""

from __future__ import annotations

import uuid
from typing import Any

from .memory import MemorySystem
from .secrets import looks_like_secret, redact
from .storage import Store
from .types import MemoryKind

IMMUTABLE_DOMAINS = frozenset({"spend", "security"})
PROTECTED_DOMAINS = frozenset({"spend", "security", "permissions", "mcp", "git_publish", "trading"})

_SPEND_MARKERS = (
    "spend",
    "auto spend",
    "automatic spending",
    "auto_limit",
    "cost limit",
    "paid provider",
    "allow $",
    "raise the budget",
)
_SECURITY_MARKERS = (
    "disable security",
    "firewall",
    "trust mcp",
    "unknown mcp",
    "git push",
    "git merge",
    "release",
    "trading execute",
    "red action",
    "permission table",
    "keychain dump",
    "store the secret",
    "ssh key",
)
_PERMISSION_MARKERS = (
    "always approve",
    "never ask",
    "auto approve",
    "skip approval",
    "don't ask me",
    "do not ask me",
)
_MCP_MARKERS = (
    "trust this mcp",
    "allow mcp",
    "install mcp",
)


class LearningDenied(ValueError):
    pass


def classify_text(text: str) -> tuple[str, bool, bool]:
    """Return (domain, protected, immutable)."""
    blob = (text or "").lower()
    if any(m in blob for m in _SPEND_MARKERS) or ("$" in blob and "spend" in blob):
        return "spend", True, True
    if any(m in blob for m in _SECURITY_MARKERS):
        return "security", True, True
    if any(m in blob for m in _MCP_MARKERS):
        return "mcp", True, False
    if any(m in blob for m in _PERMISSION_MARKERS):
        return "permissions", True, False
    return "preference", False, False


class LearningStore:
    def __init__(self, store: Store, memory: MemorySystem) -> None:
        self.store = store
        self.memory = memory

    def observe(
        self,
        kind: str,
        summary: str,
        data: dict[str, Any] | None = None,
        mission_id: str | None = None,
    ) -> dict[str, Any]:
        if looks_like_secret(summary) or looks_like_secret(str(data or "")):
            raise LearningDenied("Refusing to store secrets in learning.")
        item_id = str(uuid.uuid4())
        now = self.store.now()
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO learning_observations (id, ts, kind, summary, data_json, mission_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (item_id, now, kind, redact(summary), self.store.dumps(data or {}), mission_id),
            )
        return self.get_observation(item_id)

    def get_observation(self, item_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM learning_observations WHERE id = ?", (item_id,)).fetchone()
            if row is None:
                raise KeyError(item_id)
            item = dict(row)
        item["data"] = self.store.loads(item.pop("data_json"), {})
        return item

    def propose_from(self, observation: dict[str, Any]) -> dict[str, Any]:
        summary = str(observation.get("summary") or "")
        domain, protected, immutable = classify_text(summary)
        status = "blocked" if immutable else "proposed"
        item_id = str(uuid.uuid4())
        now = self.store.now()
        title = "Protected policy change" if protected else "Remember this"
        body = (
            "Learning cannot change spending or security. Use Permissions for real approvals."
            if immutable
            else summary
        )
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO learning_proposals
                   (id, observation_id, ts, domain, title, body, protected, immutable, status, applied)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                (
                    item_id,
                    observation["id"],
                    now,
                    domain,
                    title,
                    body,
                    1 if protected else 0,
                    1 if immutable else 0,
                    status,
                ),
            )
        proposal = self.get_proposal(item_id)
        if not protected and not immutable:
            self._write_preference(proposal)
            self._mark_applied(item_id, "accepted")
            return self.get_proposal(item_id)
        return proposal

    def teach(self, text: str) -> dict[str, Any]:
        observation = self.observe("user_preference", text)
        proposal = self.propose_from(observation)
        if proposal["immutable"]:
            reply = "I will not change spending or security from memory. That always needs a real approval in Permissions, and learning cannot override it."
        elif proposal["protected"] and proposal["status"] == "proposed":
            reply = "That looks protected. I proposed it under Learning and will not apply it until you review it. I will not silently change permissions."
        else:
            reply = "I’ll remember that. It does not change spending or security."
        return {"observation": observation, "proposal": proposal, "reply": reply}

    def note_mission(self, mission: dict[str, Any]) -> dict[str, Any] | None:
        objective = str(mission.get("objective") or "")
        status = str(mission.get("status") or "")
        summary = f"Mission {status}: {objective[:160]}"
        observation = self.observe(
            "mission_outcome",
            summary,
            {
                "status": status,
                "intent": ((mission.get("plan") or {}).get("intent") if isinstance(mission.get("plan"), dict) else None),
            },
            mission_id=mission.get("id"),
        )
        domain, protected, immutable = classify_text(objective)
        if protected or immutable:
            return self.propose_from({**observation, "summary": objective})
        return observation

    def accept(self, proposal_id: str) -> dict[str, Any]:
        proposal = self.get_proposal(proposal_id)
        if proposal["immutable"] or proposal["domain"] in IMMUTABLE_DOMAINS:
            raise LearningDenied("Learning cannot change spending or security policy.")
        if proposal["protected"] and proposal["status"] == "proposed":
            self._write_preference(proposal)
            self._mark_applied(proposal_id, "accepted")
            return self.get_proposal(proposal_id)
        if proposal["status"] == "accepted":
            return proposal
        self._write_preference(proposal)
        self._mark_applied(proposal_id, "accepted")
        return self.get_proposal(proposal_id)

    def reject(self, proposal_id: str) -> dict[str, Any]:
        self._mark_applied(proposal_id, "rejected", applied=False)
        return self.get_proposal(proposal_id)

    def get_proposal(self, proposal_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM learning_proposals WHERE id = ?", (proposal_id,)).fetchone()
            if row is None:
                raise KeyError(proposal_id)
            item = dict(row)
        item["protected"] = bool(item["protected"])
        item["immutable"] = bool(item["immutable"])
        item["applied"] = bool(item["applied"])
        return item

    def list_observations(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM learning_observations ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
        items = []
        for row in rows:
            item = dict(row)
            item["data"] = self.store.loads(item.pop("data_json"), {})
            items.append(item)
        return items

    def list_proposals(self, status: str | None = None) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            if status:
                rows = conn.execute(
                    "SELECT * FROM learning_proposals WHERE status = ? ORDER BY ts DESC", (status,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM learning_proposals ORDER BY ts DESC").fetchall()
        out = []
        for row in rows:
            item = dict(row)
            item["protected"] = bool(item["protected"])
            item["immutable"] = bool(item["immutable"])
            item["applied"] = bool(item["applied"])
            out.append(item)
        return out

    def snapshot(self) -> dict[str, Any]:
        return {
            "observations": self.list_observations(20),
            "proposals": self.list_proposals(),
            "pending": self.list_proposals("proposed"),
            "blocked": self.list_proposals("blocked"),
            "cannot_change": sorted(IMMUTABLE_DOMAINS),
            "protected_domains": sorted(PROTECTED_DOMAINS),
            "note": "Observe → propose → ask. Learning cannot silently change spend or security.",
        }

    def _write_preference(self, proposal: dict[str, Any]) -> None:
        if proposal["domain"] in IMMUTABLE_DOMAINS or proposal.get("immutable"):
            raise LearningDenied("Learning cannot change spending or security policy.")
        # Memory only. Never mutates CostManager, PermissionEngine, or MCP trust.
        self.memory.add(MemoryKind.DECISION, proposal["title"], proposal["body"])

    def _mark_applied(self, proposal_id: str, status: str, applied: bool = True) -> None:
        with self.store.connect() as conn:
            conn.execute(
                "UPDATE learning_proposals SET status = ?, applied = ? WHERE id = ?",
                (status, 1 if applied else 0, proposal_id),
            )
