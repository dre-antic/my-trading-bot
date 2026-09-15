"""Real coding mission as far as this Linux VM can go. Not simulated."""

from __future__ import annotations

import json
from pathlib import Path

from jarvis.kernel import KERNEL
from jarvis.types import AutonomyMode


def test_build_task_list_end_to_end(app, jarvis_env: Path):
    KERNEL.set_mode(AutonomyMode.ASSIST)
    result = app.orchestrator.handle_text("Build me a simple task-list application")
    mission = result["mission"]
    assert mission["status"] == "COMPLETED"
    path = Path(mission["result"]["path"])
    assert path.exists()
    assert (path / "tasklist" / "app.py").exists()
    assert (path / "tests" / "test_tasks.py").exists()
    verified = mission["result"]["verified"]
    assert verified["ok"] is True
    assert verified["results"]["task can be created"] is True
    assert verified["results"]["task can be deleted"] is True
    assert verified["results"]["tests pass"] is True
    review = mission["result"]["review"]
    assert review["passed"] is True
    cursor = mission["result"]["cursor"]
    # Honest Cursor adapter: disconnected is allowed; faking success is not.
    if cursor:
        health = cursor.get("health")
        cursor_result = cursor.get("result") or {}
        if health == "disconnected":
            assert not cursor_result.get("ok")
    worker = mission["result"]["worker"]
    assert worker in {"local-coding", "cursor-acp"}
    # Evidence exists
    kinds = {e.get("kind") for e in mission["evidence"]}
    assert "coding" in kinds
    assert "review" in kinds
    # No secrets in mission json
    blob = json.dumps(mission)
    assert "BEGIN PRIVATE KEY" not in blob
    assert "sk-" not in blob


def test_stop_cancels_running_mission(app):
    KERNEL.stop_now()
    result = app.orchestrator.handle_text("Build me a simple task-list application")
    assert result["kind"] == "halt" or result.get("mission", {}).get("status") in {"CANCELLED", None}
