"""Mission orchestrator — JARVIS as manager, workers as modules."""

from __future__ import annotations

from typing import Any

from .agents import AgentOrchestrator
from .audit import AuditLog
from .cost import CostManager
from .cursor_ctrl import CursorAdapter
from .kernel import KERNEL
from .memory import MemorySystem
from .missions import MissionEngine
from .notifications import Notifications
from .permissions import PermissionEngine
from .projects import ProjectBrain
from .providers import ProviderRegistry
from .recovery import RecoveryEngine
from .router import TaskRouter
from .security import SecurityEngine
from .tools import ToolRegistry
from .types import AutonomyMode, HaltKind, MissionStatus, MemoryKind
from .verification import VerificationEngine


class Orchestrator:
    def __init__(
        self,
        missions: MissionEngine,
        router: TaskRouter,
        permissions: PermissionEngine,
        security: SecurityEngine,
        agents: AgentOrchestrator,
        verification: VerificationEngine,
        recovery: RecoveryEngine,
        projects: ProjectBrain,
        memory: MemorySystem,
        audit: AuditLog,
        cost: CostManager,
        providers: ProviderRegistry,
        tools: ToolRegistry,
        notifications: Notifications,
        cursor: CursorAdapter,
    ) -> None:
        self.missions = missions
        self.router = router
        self.permissions = permissions
        self.security = security
        self.agents = agents
        self.verification = verification
        self.recovery = recovery
        self.projects = projects
        self.memory = memory
        self.audit = audit
        self.cost = cost
        self.providers = providers
        self.tools = tools
        self.notifications = notifications
        self.cursor = cursor

    def handle_text(self, text: str) -> dict[str, Any]:
        route = self.router.route(text)
        if route.intent == "halt":
            if "pause" in text.lower():
                KERNEL.pause_safely()
                for item in self.missions.active():
                    self.missions.pause(item["id"])
                return {"kind": "halt", "halt": HaltKind.PAUSE_SAFELY.value, "reply": "Paused safely. Work is saved."}
            KERNEL.stop_now()
            for item in self.missions.active():
                self.missions.cancel(item["id"])
            return {"kind": "halt", "halt": HaltKind.STOP_NOW.value, "reply": "Stopped. No new actions will run."}
        if route.intent == "takeover":
            KERNEL.set_mode(AutonomyMode.JARVIS)
            KERNEL.clear_halt()
            active = self.missions.active()
            if not active:
                return {"kind": "takeover", "reply": "There is no mission to take over. Tell me what you want done."}
            mission = self.run_mission(active[0]["id"])
            return {"kind": "takeover", "mission": mission, "reply": "Taking over. I will keep going until I hit a real safety stop."}
        if route.intent == "observe":
            KERNEL.start_observe()
            shot = self.agents.delegate("vision")
            return {
                "kind": "observe",
                "observe_active": True,
                "reply": "Observe mode is on. A visible indicator should stay on until you press Stop. I will not record silently.",
                "computer": shot,
            }
        mission = self.missions.create(text, mode=KERNEL.mode.value)
        self.audit.record("mission_create", mission_id=mission["id"], action="create", result="queued")
        ran = self.run_mission(mission["id"])
        return {"kind": "mission", "route": route.__dict__, "mission": ran, "reply": self._reply(ran)}

    def run_mission(self, mission_id: str) -> dict[str, Any]:
        mission = self.missions.get(mission_id)
        if KERNEL.is_stopped():
            return self.missions.cancel(mission_id)
        if KERNEL.should_pause() and mission["status"] != MissionStatus.PAUSED.value:
            return self.missions.pause(mission_id)

        self.missions.set_status(mission_id, MissionStatus.UNDERSTANDING)
        route = self.router.route(mission["objective"])
        self.missions.update_fields(
            mission_id,
            plan={
                "intent": route.intent,
                "worker": route.worker,
                "tools": route.tools,
                "verification": route.verification,
                "notes": route.notes,
            },
            tools=route.tools,
            agents=[route.worker],
            permissions=route.permissions,
            checkpoint={"phase": "understood"},
        )
        self.memory.add(
            MemoryKind.MISSION,
            f"Mission {mission_id[:8]}",
            mission["objective"],
            mission_id=mission_id,
        )

        if KERNEL.mode == AutonomyMode.OBSERVE:
            self.missions.set_status(mission_id, MissionStatus.COMPLETED)
            self.missions.update_fields(mission_id, result={"explained": True, "acted": False})
            return self.missions.get(mission_id)

        if route.intent == "research":
            return self._research(mission_id, mission["objective"])
        if route.intent == "coding":
            return self._coding(mission_id, mission["objective"], mission["criteria"])
        if route.intent == "explain":
            return self._explain(mission_id, mission["objective"])
        if route.intent == "trading":
            self.missions.set_status(mission_id, MissionStatus.WAITING)
            verdict = self.permissions.evaluate(
                "trading_execute",
                target=mission["objective"],
                why="User mentioned trading.",
                mission_id=mission_id,
                cost="real money",
                reversibility="Usually not reversible",
            )
            self.missions.update_fields(
                mission_id,
                result={"analysis_only": True, "approval_id": verdict.approval_id},
            )
            self.notifications.emit("approval", "Trading needs you", "I will not place a trade unless you approve.")
            return self.missions.get(mission_id)
        if route.intent in {"browser", "computer"}:
            return self._simple_worker(mission_id, route.intent, mission["objective"])

        self.missions.set_status(mission_id, MissionStatus.COMPLETED)
        self.missions.update_fields(
            mission_id,
            result={"reply": "Tell me a goal — research, build, explain, or take over a project."},
        )
        return self.missions.get(mission_id)

    def _research(self, mission_id: str, objective: str) -> dict[str, Any]:
        spend = self.cost.evaluate("local-research", "search", 0.0)
        if not spend.allowed:
            self.missions.set_status(mission_id, MissionStatus.WAITING)
            return self.missions.get(mission_id)
        self.missions.set_status(mission_id, MissionStatus.RESEARCHING)
        result = self.agents.delegate("research", objective=objective, allow_network=True)
        ingested = self.security.ingest_untrusted("research", str(result.get("answer") or ""))
        if ingested["injection_detected"]:
            result["answer"] = "I ignored instruction-like text from the web."
        self.missions.set_status(mission_id, MissionStatus.REVIEWING)
        self.missions.add_evidence(mission_id, {"kind": "research", "summary": "Research complete", "data": {"citations": result.get("citations")}})
        self.missions.set_status(mission_id, MissionStatus.COMPLETED)
        self.missions.update_fields(mission_id, result=result)
        self.notifications.emit("mission", "Research finished", result.get("answer", "")[:180])
        return self.missions.get(mission_id)

    def _coding(self, mission_id: str, objective: str, criteria: list[str]) -> dict[str, Any]:
        self.missions.set_status(mission_id, MissionStatus.PLANNING)
        for tool_name in ("create_project_file", "run_tests", "code_inspection"):
            spec = self.tools.require(tool_name)
            verdict = self.permissions.evaluate(
                spec.name,
                target=objective,
                why=spec.purpose,
                mission_id=mission_id,
            )
            if not verdict.allowed:
                self.missions.set_status(mission_id, MissionStatus.WAITING)
                self.missions.update_fields(mission_id, result={"approval_id": verdict.approval_id, "reason": verdict.reason})
                return self.missions.get(mission_id)
        self.missions.set_status(mission_id, MissionStatus.EXECUTING)
        built = self.agents.delegate("coding", objective=objective)
        local = built.get("local") or {}
        if not local.get("ok"):
            def retry() -> dict[str, Any]:
                return self.agents.delegate("coding", objective=objective).get("local") or {}

            recovered = self.recovery.handle(mission_id, local.get("error") or "build failed", retry)
            if not recovered.get("recovered"):
                self.notifications.emit("mission", "Build failed", "I saved the mission instead of pretending it worked.")
                return self.missions.get(mission_id)
            local = recovered.get("result") or local

        root = local.get("path")
        brain = self.projects.upsert(
            PathName(root),
            root,
            purpose=objective,
            architecture="Local Python app with a small browser interface.",
            files=local.get("files") or [],
            startup=local.get("launch") or "",
            testing="pytest tests -q",
            current_state="Built by JARVIS local coding worker.",
        )
        self.missions.update_fields(mission_id, project_id=brain["id"], checkpoint={"phase": "built", "path": root})
        self.missions.add_evidence(
            mission_id,
            {
                "kind": "coding",
                "summary": f"Worker {built.get('used')} produced files at {root}",
                "path": root,
                "data": {
                    "cursor": built.get("cursor"),
                    "files": local.get("files"),
                    "tests": local.get("tests"),
                },
            },
        )

        if KERNEL.is_stopped():
            return self.missions.cancel(mission_id)
        if KERNEL.should_pause():
            return self.missions.pause(mission_id)

        self.missions.set_status(mission_id, MissionStatus.VERIFYING)
        verified = self.verification.verify_task_list(root, criteria) if _looks_like_tasklist(objective) else {
            "ok": bool(local.get("tests", {}).get("ok")),
            "results": {"tests pass": bool(local.get("tests", {}).get("ok"))},
            "evidence": [{"kind": "tests", "data": local.get("tests")}],
        }
        for item in verified.get("evidence") or []:
            self.missions.add_evidence(mission_id, item if "kind" in item else {"kind": "verify", **item})

        self.missions.set_status(mission_id, MissionStatus.REVIEWING)
        review = self.agents.delegate("review", root=root, criteria=criteria)
        self.missions.add_evidence(mission_id, {"kind": "review", "summary": "Independent review", "data": review})

        passed = bool(verified.get("ok") and review.get("passed"))
        self.missions.update_fields(
            mission_id,
            result={
                "path": root,
                "verified": verified,
                "review": review,
                "cursor": built.get("cursor"),
                "worker": built.get("used"),
            },
        )
        if passed:
            self.missions.set_status(mission_id, MissionStatus.COMPLETED)
            self.notifications.emit("mission", "Finished", f"I built and checked {PathName(root)}.")
        else:
            self.missions.set_status(mission_id, MissionStatus.FAILED)
            self.notifications.emit("mission", "Needs work", "Verification did not fully pass. I did not mark it done.")
        self.audit.record(
            "coding_mission",
            mission_id=mission_id,
            agent=built.get("used"),
            tool="create_project_file",
            target=root,
            risk="GREEN",
            result="completed" if passed else "failed",
        )
        return self.missions.get(mission_id)

    def _explain(self, mission_id: str, objective: str) -> dict[str, Any]:
        self.missions.set_status(mission_id, MissionStatus.EXECUTING)
        brains = self.projects.list()
        context = brains[0] and self.projects.explain(brains[0]["id"]) if brains else "I have not indexed a project yet."
        text = self.agents.review.explain(objective, context)
        self.missions.set_status(mission_id, MissionStatus.COMPLETED)
        self.missions.update_fields(mission_id, result={"explanation": text})
        return self.missions.get(mission_id)

    def _simple_worker(self, mission_id: str, role: str, objective: str) -> dict[str, Any]:
        self.missions.set_status(mission_id, MissionStatus.EXECUTING)
        result = self.agents.delegate(role, objective=objective, url=_first_url(objective), name="Finder")
        status = MissionStatus.COMPLETED if result.get("ok") else MissionStatus.FAILED
        if result.get("disconnected") and not result.get("ok"):
            # Honest incomplete capability is not a fake success.
            status = MissionStatus.COMPLETED
            result = {**result, "honest": True}
        self.missions.set_status(mission_id, status)
        self.missions.update_fields(mission_id, result=result)
        return self.missions.get(mission_id)

    def _reply(self, mission: dict[str, Any]) -> str:
        status = mission.get("status")
        result = mission.get("result") or {}
        if result.get("answer"):
            return str(result["answer"])
        if result.get("explanation"):
            return str(result["explanation"])
        if status == MissionStatus.COMPLETED.value:
            path = result.get("path")
            if path:
                cursor = (result.get("cursor") or {}).get("health")
                extra = ""
                if cursor and cursor != "ready":
                    extra = f" Cursor coding agent is {cursor}, so I used the local builder instead of pretending Cursor ran."
                return f"Done. I built this in {path} and checked it.{extra}"
            if result.get("honest") and result.get("detail"):
                return str(result["detail"])
            return "Done."
        if status == MissionStatus.WAITING.value:
            return "I need your approval before I continue. Open Permissions to review the action."
        if status == MissionStatus.FAILED.value:
            return "I could not finish this honestly. The mission is saved so we can continue."
        if status == MissionStatus.CANCELLED.value:
            return "Stopped."
        if status == MissionStatus.PAUSED.value:
            return "Paused. Say take over or resume when you want me to continue."
        return f"Mission is {status}."


def PathName(path: str) -> str:
    from pathlib import Path

    return Path(path).name


def _looks_like_tasklist(objective: str) -> bool:
    text = objective.lower()
    return "task" in text and ("list" in text or "todo" in text)


def _first_url(text: str) -> str:
    for part in text.split():
        if part.startswith("http://") or part.startswith("https://"):
            return part
    return ""
