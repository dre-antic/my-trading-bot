"""Mission engine with persisted lifecycle and checkpoints."""

from __future__ import annotations

import uuid
from typing import Any

from .storage import Store
from .types import ALLOWED_TRANSITIONS, MissionStatus, TERMINAL_STATUSES


class InvalidTransition(RuntimeError):
    pass


class MissionEngine:
    def __init__(self, store: Store) -> None:
        self.store = store

    def create(
        self,
        objective: str,
        *,
        mode: str = "ASSIST",
        criteria: list[str] | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        mission_id = str(uuid.uuid4())
        now = self.store.now()
        defaults = criteria or self.default_criteria(objective)
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO missions (
                    id, objective, status, mode, criteria_json, created_at, updated_at, project_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    mission_id,
                    objective,
                    MissionStatus.QUEUED.value,
                    mode,
                    self.store.dumps(defaults),
                    now,
                    now,
                    project_id,
                ),
            )
        self.event(mission_id, "created", f"Mission created: {objective}")
        return self.get(mission_id)

    def default_criteria(self, objective: str) -> list[str]:
        text = objective.lower()
        if "task-list" in text or "todo" in text or "task list" in text:
            return [
                "application launches",
                "task can be created",
                "task can be edited",
                "task persists",
                "task can be deleted",
                "interface responds",
                "no critical errors",
                "tests pass",
            ]
        return [
            "request understood",
            "work completed or blocked honestly",
            "evidence recorded",
            "no unauthorized spending",
            "no secret leakage",
        ]

    def get(self, mission_id: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM missions WHERE id = ?", (mission_id,)).fetchone()
            if row is None:
                raise KeyError(mission_id)
            mission = dict(row)
            events = conn.execute(
                "SELECT * FROM mission_events WHERE mission_id = ? ORDER BY id ASC",
                (mission_id,),
            ).fetchall()
        mission["plan"] = self.store.loads(mission.pop("plan_json"), {})
        mission["criteria"] = self.store.loads(mission.pop("criteria_json"), [])
        mission["tasks"] = self.store.loads(mission.pop("tasks_json"), [])
        mission["tools"] = self.store.loads(mission.pop("tools_json"), [])
        mission["agents"] = self.store.loads(mission.pop("agents_json"), [])
        mission["permissions"] = self.store.loads(mission.pop("permissions_json"), [])
        mission["evidence"] = self.store.loads(mission.pop("evidence_json"), [])
        mission["errors"] = self.store.loads(mission.pop("errors_json"), [])
        mission["recovery"] = self.store.loads(mission.pop("recovery_json"), {})
        mission["result"] = self.store.loads(mission.pop("result_json"), {})
        mission["checkpoint"] = self.store.loads(mission.pop("checkpoint_json"), {})
        mission["events"] = [dict(e) for e in events]
        return mission

    def list(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute(
                "SELECT id, objective, status, mode, created_at, updated_at FROM missions ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def set_status(self, mission_id: str, status: MissionStatus) -> dict[str, Any]:
        current = self.get(mission_id)
        current_status = MissionStatus(current["status"])
        if status != current_status and status not in ALLOWED_TRANSITIONS[current_status]:
            raise InvalidTransition(f"{current_status.value} -> {status.value} is not allowed")
        with self.store.connect() as conn:
            conn.execute(
                "UPDATE missions SET status = ?, updated_at = ? WHERE id = ?",
                (status.value, self.store.now(), mission_id),
            )
        self.event(mission_id, "status", status.value)
        return self.get(mission_id)

    def update_fields(self, mission_id: str, **fields: Any) -> dict[str, Any]:
        mapping = {
            "plan": "plan_json",
            "criteria": "criteria_json",
            "tasks": "tasks_json",
            "tools": "tools_json",
            "agents": "agents_json",
            "permissions": "permissions_json",
            "evidence": "evidence_json",
            "errors": "errors_json",
            "recovery": "recovery_json",
            "result": "result_json",
            "checkpoint": "checkpoint_json",
            "project_id": "project_id",
            "mode": "mode",
            "objective": "objective",
        }
        assignments = ["updated_at = ?"]
        values: list[Any] = [self.store.now()]
        for key, value in fields.items():
            column = mapping.get(key, key)
            if column.endswith("_json"):
                values.append(self.store.dumps(value))
            else:
                values.append(value)
            assignments.append(f"{column} = ?")
        values.append(mission_id)
        with self.store.connect() as conn:
            conn.execute(f"UPDATE missions SET {', '.join(assignments)} WHERE id = ?", values)
        return self.get(mission_id)

    def add_evidence(self, mission_id: str, evidence: dict[str, Any]) -> None:
        mission = self.get(mission_id)
        items = list(mission["evidence"])
        items.append(evidence)
        self.update_fields(mission_id, evidence=items)
        self.event(mission_id, "evidence", evidence.get("summary", "evidence recorded"), evidence)

    def add_error(self, mission_id: str, error: str, data: dict[str, Any] | None = None) -> None:
        mission = self.get(mission_id)
        errors = list(mission["errors"])
        errors.append({"error": error, "data": data or {}, "ts": self.store.now()})
        self.update_fields(mission_id, errors=errors)
        self.event(mission_id, "error", error, data or {})

    def event(self, mission_id: str, kind: str, message: str, data: dict[str, Any] | None = None) -> None:
        with self.store.connect() as conn:
            conn.execute(
                "INSERT INTO mission_events (mission_id, ts, kind, message, data_json) VALUES (?, ?, ?, ?, ?)",
                (mission_id, self.store.now(), kind, message, self.store.dumps(data or {})),
            )

    def pause(self, mission_id: str) -> dict[str, Any]:
        mission = self.get(mission_id)
        if MissionStatus(mission["status"]) in TERMINAL_STATUSES:
            return mission
        checkpoint = dict(mission["checkpoint"])
        checkpoint["paused_from"] = mission["status"]
        self.update_fields(mission_id, checkpoint=checkpoint)
        return self.set_status(mission_id, MissionStatus.PAUSED)

    def resume(self, mission_id: str) -> dict[str, Any]:
        mission = self.get(mission_id)
        if MissionStatus(mission["status"]) != MissionStatus.PAUSED:
            raise InvalidTransition("Only paused missions can be resumed")
        previous = mission["checkpoint"].get("paused_from", MissionStatus.EXECUTING.value)
        try:
            target = MissionStatus(previous)
        except ValueError:
            target = MissionStatus.EXECUTING
        if target == MissionStatus.PAUSED:
            target = MissionStatus.EXECUTING
        return self.set_status(mission_id, target)

    def cancel(self, mission_id: str) -> dict[str, Any]:
        mission = self.get(mission_id)
        status = MissionStatus(mission["status"])
        if status in {MissionStatus.COMPLETED, MissionStatus.CANCELLED}:
            return mission
        return self.set_status(mission_id, MissionStatus.CANCELLED)

    def active(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute(
                "SELECT id, objective, status FROM missions WHERE status NOT IN (?, ?, ?)",
                (
                    MissionStatus.COMPLETED.value,
                    MissionStatus.FAILED.value,
                    MissionStatus.CANCELLED.value,
                ),
            ).fetchall()
            return [dict(r) for r in rows]
