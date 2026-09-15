from jarvis.kernel import KERNEL
from jarvis.storage import Store
from jarvis.types import MissionStatus


def test_persistence_across_store_reopen(jarvis_env, app):
    mission = app.missions.create("Keep this")
    app.missions.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    app.missions.update_fields(mission["id"], checkpoint={"phase": "saved"})
    mid = mission["id"]
    again = Store()
    from jarvis.missions import MissionEngine

    engine = MissionEngine(again)
    loaded = engine.get(mid)
    assert loaded["objective"] == "Keep this"
    assert loaded["checkpoint"]["phase"] == "saved"
    assert loaded["status"] == "UNDERSTANDING"


def test_recovery_bounds(app):
    mission = app.missions.create("fail once")
    app.missions.set_status(mission["id"], MissionStatus.UNDERSTANDING)
    app.missions.set_status(mission["id"], MissionStatus.EXECUTING)
    calls = {"n": 0}

    def retry():
        calls["n"] += 1
        return {"ok": False, "error": "still broken"}

    result = app.orchestrator.recovery.handle(mission["id"], "boom", retry)
    assert result["recovered"] is False
    failed = app.missions.get(mission["id"])
    assert failed["status"] == "FAILED"


def test_delegation_least_privilege_roles(app):
    built = app.orchestrator.agents.delegate("coding", objective="Build me a simple task-list application")
    assert built["role"] == "coding"
    assert built["local"]["ok"] is True
    review = app.orchestrator.agents.delegate("review", root=built["local"]["path"], criteria=["tests pass"])
    assert review["independent"] is True
    assert review["reviewer"] == "review-agent"


def test_browser_marks_untrusted(app):
    # file URL is rejected; only http(s)
    result = app.orchestrator.agents.browser.fetch("file:///etc/passwd")
    assert result["ok"] is False
