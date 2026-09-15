from jarvis.kernel import KERNEL
from jarvis.types import ApprovalDecision, AutonomyMode, RiskLevel


def test_green_auto(app):
    verdict = app.permissions.evaluate("web_research", target="https://example.com", why="news")
    assert verdict.allowed
    assert verdict.risk == RiskLevel.GREEN
    assert not verdict.needs_approval


def test_red_always_confirms(app):
    KERNEL.set_mode(AutonomyMode.JARVIS)
    verdict = app.permissions.evaluate("git_push", target="origin", why="publish")
    assert not verdict.allowed
    assert verdict.needs_approval
    assert verdict.risk == RiskLevel.RED


def test_safe_mode_blocks_yellow(app):
    KERNEL.set_mode(AutonomyMode.SAFE)
    verdict = app.permissions.evaluate("install_software", target="brew", why="tooling")
    assert not verdict.allowed


def test_safe_mode_does_not_write_project_files(app):
    KERNEL.set_mode(AutonomyMode.SAFE)
    verdict = app.permissions.evaluate("create_project_file", target="app.py", why="build")
    assert not verdict.allowed
    built = app.orchestrator.handle_text("Build me a simple task-list application")
    assert built["mission"]["status"] != "COMPLETED"


def test_approve_reject(app):
    verdict = app.permissions.evaluate("upload", target="file", why="share")
    assert verdict.approval_id
    app.permissions.decide(verdict.approval_id, ApprovalDecision.APPROVE)
    row = app.permissions.get(verdict.approval_id)
    assert row["status"] == "APPROVE"
