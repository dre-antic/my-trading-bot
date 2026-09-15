def test_coding_route(app):
    decision = app.router.route("Build me a simple task-list application")
    assert decision.intent == "coding"
    assert decision.worker == "coding"
    assert "run_tests" in decision.tools
    assert decision.auto_allowed


def test_research_route(app):
    decision = app.router.route("What happened with NVIDIA today?")
    assert decision.intent == "research"
    assert decision.worker == "research"


def test_computer_and_takeover_and_stop(app):
    computer = app.router.route("Open this app and click the settings button.")
    assert computer.intent == "computer"
    takeover = app.router.route("Take over.")
    assert takeover.intent == "takeover"
    stop = app.router.route("Stop JARVIS")
    assert stop.intent == "halt"
