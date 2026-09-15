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
