import pytest

from jarvis.missions import InvalidTransition, MissionEngine
from jarvis.types import ALLOWED_TRANSITIONS, AutonomyMode, MissionStatus
from jarvis.kernel import KERNEL


def test_lifecycle_and_invalid_transition(app):
    engine: MissionEngine = app.missions
    mission = engine.create("Build a demo")
    assert mission["status"] == MissionStatus.QUEUED.value
    engine.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    engine.set_status(mission["id"], MissionStatus.PLANNING)
    engine.set_status(mission["id"], MissionStatus.EXECUTING)
    engine.set_status(mission["id"], MissionStatus.VERIFYING)
    engine.set_status(mission["id"], MissionStatus.REVIEWING)
    engine.set_status(mission["id"], MissionStatus.COMPLETED)
    done = engine.get(mission["id"])
    assert done["status"] == "COMPLETED"
    assert done["criteria"]
    try:
        engine.set_status(mission["id"], MissionStatus.EXECUTING)
        raise AssertionError("completed missions must not restart without recovery")
    except InvalidTransition:
        pass


def test_researching_cannot_jump_to_reviewing(app):
    """The Mac crash: RESEARCHING → REVIEWING is not a legal hop."""
    assert MissionStatus.REVIEWING not in ALLOWED_TRANSITIONS[MissionStatus.RESEARCHING]
    engine = app.missions
    mission = engine.create("Research this company.")
    engine.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    engine.set_status(mission["id"], MissionStatus.RESEARCHING)
    with pytest.raises(InvalidTransition, match=r"RESEARCHING -> REVIEWING"):
        engine.set_status(mission["id"], MissionStatus.REVIEWING)


def test_research_mission_uses_legal_transitions(app, monkeypatch):
    def fake_answer(question, allow_network=True):
        return {
            "ok": True,
            "question": question,
            "answer": "Canned public facts. No paid API was used.",
            "citations": [{"title": "example", "url": "https://example.com"}],
        }

    monkeypatch.setattr(app.orchestrator.agents.research, "answer", fake_answer)
    result = app.orchestrator.handle_text("Research this company.")
    mission = result["mission"]
    assert mission["status"] == MissionStatus.COMPLETED.value
    statuses = [e["message"] for e in mission["events"] if e["kind"] == "status"]
    assert "RESEARCHING" in statuses
    assert "REVIEWING" in statuses
    hops = list(zip(statuses, statuses[1:]))
    assert ("RESEARCHING", "REVIEWING") not in hops
    for current, nxt in hops:
        assert MissionStatus(nxt) in ALLOWED_TRANSITIONS[MissionStatus(current)], f"{current} -> {nxt}"


def test_observe_and_general_do_not_skip_to_completed(app):
    KERNEL.set_mode(AutonomyMode.OBSERVE)
    observed = app.orchestrator.handle_text("Explain this project to me.")
    assert observed["mission"]["status"] == "COMPLETED"
    statuses = [e["message"] for e in observed["mission"]["events"] if e["kind"] == "status"]
    hops = list(zip(statuses, statuses[1:]))
    assert ("UNDERSTANDING", "COMPLETED") not in hops
    for current, nxt in hops:
        assert MissionStatus(nxt) in ALLOWED_TRANSITIONS[MissionStatus(current)]


def test_pause_resume_cancel(app):
    engine = app.missions
    mission = engine.create("Long job")
    engine.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    engine.set_status(mission["id"], MissionStatus.EXECUTING)
    paused = engine.pause(mission["id"])
    assert paused["status"] == "PAUSED"
    resumed = engine.resume(mission["id"])
    assert resumed["status"] == "EXECUTING"
    cancelled = engine.cancel(mission["id"])
    assert cancelled["status"] == "CANCELLED"


def test_other_illegal_hops(app):
    engine = app.missions
    mission = engine.create("Hop check")
    engine.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    engine.set_status(mission["id"], MissionStatus.PLANNING)
    with pytest.raises(InvalidTransition, match=r"PLANNING -> REVIEWING"):
        engine.set_status(mission["id"], MissionStatus.REVIEWING)
    engine.set_status(mission["id"], MissionStatus.WAITING)
    with pytest.raises(InvalidTransition, match=r"WAITING -> UNDERSTANDING"):
        engine.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    research = engine.create("Research hops")
    engine.set_status(research["id"], MissionStatus.UNDERSTANDING)
    engine.set_status(research["id"], MissionStatus.RESEARCHING)
    with pytest.raises(InvalidTransition, match=r"RESEARCHING -> COMPLETED"):
        engine.set_status(research["id"], MissionStatus.COMPLETED)
    assert MissionStatus.COMPLETED not in ALLOWED_TRANSITIONS[MissionStatus.RESEARCHING]


def test_takeover_does_not_crash_waiting_trading(app):
    first = app.orchestrator.handle_text("buy stock NVDA")
    assert first["mission"]["status"] == "WAITING"
    takeover = app.orchestrator.handle_text("Take over.")
    mission = takeover["mission"]
    assert mission["status"] in {"WAITING", "COMPLETED", "FAILED"}
    assert (mission.get("result") or {}).get("executed") is not True
    statuses = [e["message"] for e in mission["events"] if e["kind"] == "status"]
    hops = list(zip(statuses, statuses[1:]))
    for current, nxt in hops:
        assert MissionStatus(nxt) in ALLOWED_TRANSITIONS[MissionStatus(current)], f"{current} -> {nxt}"


def test_stop_period_and_blocks_new_work(app):
    stopped = app.orchestrator.handle_text("Stop.")
    assert stopped["kind"] == "halt"
    assert KERNEL.halt.value == "STOP_NOW"
    blocked = app.orchestrator.handle_text("Build me a simple task-list application")
    assert blocked["kind"] == "halt"
    assert "mission" not in blocked
    resumed = app.orchestrator.handle_text("continue")
    assert resumed["kind"] == "halt"
    assert KERNEL.halt.value == "NONE"
    again = app.orchestrator.handle_text("Explain this project to me.")
    assert again["kind"] == "mission"
    assert again["mission"]["status"] == "COMPLETED"


def test_continue_working_is_not_resume(app):
    decision = app.router.route("Continue working on my project.")
    assert decision.intent != "resume"
    assert decision.intent != "halt"
