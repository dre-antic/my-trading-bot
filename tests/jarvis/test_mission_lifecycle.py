from jarvis.missions import InvalidTransition, MissionEngine
from jarvis.types import MissionStatus


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
