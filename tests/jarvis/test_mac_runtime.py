"""Local Mac runtime is the product. Cloud AI is optional inference."""

from pathlib import Path

from jarvis.intelligence import IntelligenceRouter
from jarvis.types import MemoryKind


def test_inventory_does_not_assume_apple_silicon(app):
    inv = app.runtime.inventory()
    assert inv["product_is_cloud"] is False
    assert inv["control_plane"] == "local"
    assert inv["hardware_verified"] is False
    assert "apple_silicon" in inv
    assert inv["docker"] in {True, False}


def test_cloud_ai_down_local_functions_still_work(app, monkeypatch):
    monkeypatch.delenv("JARVIS_CLOUD_AI", raising=False)
    snap = app.runtime.snapshot()
    assert snap["cloud_ai"]["available"] is False
    local = set(snap["works_with_cloud_ai_down"])
    for name in ("workspace_files", "missions", "memory", "local_coding"):
        assert name in local

    files = app.runtime.list_workspace()
    assert files["plane"] == "local_mac"
    item = app.memory.add(MemoryKind.USER, "local note", "works offline from cloud AI")
    assert item["title"] == "local note"
    mission = app.orchestrator.handle_text("Explain this project to me.")
    assert mission["mission"]["status"] == "COMPLETED"
    assert mission["plane"]["cloud_ai_required"] is False
    built = app.orchestrator.handle_text("Build me a simple task-list application")
    assert built["mission"]["status"] == "COMPLETED"
    assert Path(built["mission"]["result"]["path"]).exists()
    spend = app.cost.evaluate("openai", "chat", 1.0, approved=False)
    assert spend.allowed is False


def test_intelligence_router_planes(app):
    router = IntelligenceRouter(app.runtime)
    coding = router.decide(app.router.route("Build me a web application"))
    assert coding.plane == "local_mac"
    assert coding.cloud_ai_required is False
    research = router.decide(app.router.route("Research this company."))
    assert research.cloud_ai_required is False
    assert research.plane in {"external_api", "local_mac"}


def test_app_launcher_pins_python311():
    launcher = Path("packaging/macos/JARVIS.app/Contents/MacOS/JARVIS").read_text(encoding="utf-8")
    assert "python3.11" in launcher
    assert "3.14" in launcher
    install = Path("scripts/install-jarvis-macos.sh").read_text(encoding="utf-8")
    assert "Dock" in install
    assert "python3.11" in install
    assert "Right-click" in install
    build = Path("scripts/build-jarvis-macos.sh").read_text(encoding="utf-8")
    assert "jarvis-root.txt" in build
    assert "rsync" not in build
