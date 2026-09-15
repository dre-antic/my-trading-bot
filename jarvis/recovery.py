"""Bounded recovery. Capture, diagnose, maybe retry, never loop forever."""

from __future__ import annotations

from typing import Any, Callable

from .missions import MissionEngine
from .types import MissionStatus

MAX_RETRIES = 2


class RecoveryEngine:
    def __init__(self, missions: MissionEngine) -> None:
        self.missions = missions

    def handle(self, mission_id: str, error: str, retry: Callable[[], dict[str, Any]] | None = None) -> dict[str, Any]:
        mission = self.missions.get(mission_id)
        recovery = dict(mission.get("recovery") or {})
        attempts = int(recovery.get("attempts") or 0)
        self.missions.add_error(mission_id, error, {"attempts": attempts})
        if attempts >= MAX_RETRIES or retry is None:
            recovery.update({"attempts": attempts, "exhausted": True, "last_error": error})
            self.missions.update_fields(mission_id, recovery=recovery)
            self.missions.set_status(mission_id, MissionStatus.FAILED)
            return {"recovered": False, "attempts": attempts, "error": error}
        recovery["attempts"] = attempts + 1
        recovery["last_error"] = error
        self.missions.update_fields(mission_id, recovery=recovery)
        self.missions.set_status(mission_id, MissionStatus.RECOVERING)
        try:
            result = retry()
        except Exception as exc:
            return self.handle(mission_id, str(exc), retry=None)
        if result.get("ok"):
            self.missions.set_status(mission_id, MissionStatus.EXECUTING)
            return {"recovered": True, "attempts": recovery["attempts"], "result": result}
        return self.handle(mission_id, result.get("error") or "retry failed", retry=None)
