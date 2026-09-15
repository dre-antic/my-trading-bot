"""Permission engine: GREEN / YELLOW / RED plus autonomy-mode policy."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from .kernel import KERNEL
from .secrets import path_is_protected
from .storage import Store
from .types import ApprovalDecision, AutonomyMode, RiskLevel


@dataclass
class PermissionVerdict:
    allowed: bool
    risk: RiskLevel
    needs_approval: bool
    reason: str
    approval_id: str | None = None
    auto: bool = False


class PermissionEngine:
    GREEN_ACTIONS = {
        "web_research",
        "public_browse",
        "read_project_file",
        "analyze_logs",
        "safe_test",
        "launch_permitted_app",
        "create_project_file",
        "screenshot",
        "research",
        "code_inspection",
        "inspect_git",
        "create_branch",
        "create_commit",
        "inspect_diff",
        "run_tests",
        "explain",
        "observe_screen",
        "list_projects",
        "memory_read",
        "memory_write_safe",
        "system_inspect",
        "mission_status",
    }
    YELLOW_ACTIONS = {
        "install_software",
        "system_config",
        "access_outside_workspace",
        "credential_change",
        "cloud_service",
        "account_action",
        "upload",
        "send_information",
        "download_file",
        "browser_login",
        "mcp_install",
    }
    RED_ACTIONS = {
        "spend_money",
        "financial_transaction",
        "trading_execute",
        "delete_important",
        "permanent_delete",
        "database_delete",
        "docker_volume_delete",
        "security_config",
        "firewall_change",
        "ssh_change",
        "publish",
        "git_push",
        "git_merge",
        "release",
        "legal_submission",
        "account_ownership",
        "credential_exposure",
        "read_secret_file",
        "disable_security",
        "run_as_administrator",
        "execute_download",
    }

    def __init__(self, store: Store) -> None:
        self.store = store

    def classify(self, action: str, target: str = "") -> RiskLevel:
        if path_is_protected(target) or action in {"read_secret_file", "credential_exposure"}:
            return RiskLevel.RED
        if action in self.RED_ACTIONS:
            return RiskLevel.RED
        if action in self.YELLOW_ACTIONS:
            return RiskLevel.YELLOW
        if action in self.GREEN_ACTIONS:
            return RiskLevel.GREEN
        if "delete" in action or "push" in action or "publish" in action:
            return RiskLevel.RED
        if "install" in action or "upload" in action or "cloud" in action:
            return RiskLevel.YELLOW
        return RiskLevel.YELLOW

    def evaluate(
        self,
        action: str,
        target: str = "",
        why: str = "",
        cost: str = "$0",
        data: dict[str, Any] | None = None,
        mission_id: str | None = None,
        reversibility: str = "Usually reversible",
    ) -> PermissionVerdict:
        if KERNEL.is_stopped():
            return PermissionVerdict(False, RiskLevel.RED, False, "JARVIS is stopped.")
        if KERNEL.mode == AutonomyMode.OBSERVE:
            if action not in {"explain", "observe_screen", "mission_status", "list_projects", "memory_read"}:
                return PermissionVerdict(
                    False, RiskLevel.YELLOW, False, "Observe mode does not take actions."
                )
        risk = self.classify(action, target)
        if KERNEL.mode == AutonomyMode.SAFE and risk != RiskLevel.GREEN:
            return PermissionVerdict(
                False,
                risk,
                True,
                "Safe mode blocks consequential actions.",
            )
        if risk == RiskLevel.GREEN:
            return PermissionVerdict(True, risk, False, "Green actions run automatically.", auto=True)
        if risk == RiskLevel.RED:
            approval_id = self._create_approval(
                mission_id, action, target, why, data or {}, cost, risk, reversibility
            )
            return PermissionVerdict(
                False,
                risk,
                True,
                "Red actions always require explicit confirmation.",
                approval_id=approval_id,
            )
        # YELLOW
        if KERNEL.mode == AutonomyMode.JARVIS:
            return PermissionVerdict(
                True,
                risk,
                False,
                "Jarvis mode auto-allows yellow engineering actions (not spending or secrets).",
                auto=True,
            )
        approval_id = self._create_approval(
            mission_id, action, target, why, data or {}, cost, risk, reversibility
        )
        return PermissionVerdict(
            False,
            risk,
            True,
            "Yellow actions need approval in Assist mode.",
            approval_id=approval_id,
        )

    def _create_approval(
        self,
        mission_id: str | None,
        action: str,
        target: str,
        why: str,
        data: dict[str, Any],
        cost: str,
        risk: RiskLevel,
        reversibility: str,
    ) -> str:
        approval_id = str(uuid.uuid4())
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO approvals
                   (id, mission_id, action, target, why, data_json, cost, risk, reversibility, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    approval_id,
                    mission_id,
                    action,
                    target,
                    why,
                    self.store.dumps(data),
                    cost,
                    risk.value,
                    reversibility,
                    ApprovalDecision.PENDING.value,
                    self.store.now(),
                ),
            )
        return approval_id

    def decide(self, approval_id: str, decision: ApprovalDecision) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
            if row is None:
                raise KeyError(approval_id)
            conn.execute(
                "UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?",
                (decision.value, self.store.now(), approval_id),
            )
        return dict(row)

    def get(self, approval_id: str) -> dict[str, Any] | None:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
            return dict(row) if row else None

    def pending(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC",
                (ApprovalDecision.PENDING.value,),
            ).fetchall()
            return [dict(r) for r in rows]
