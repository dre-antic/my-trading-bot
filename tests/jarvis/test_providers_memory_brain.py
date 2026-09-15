from jarvis.memory import MemoryDenied
from jarvis.types import MemoryKind, ProviderHealth


def test_provider_health_and_local_coding(app):
    local = app.providers.get("local-coding")
    assert local.health == ProviderHealth.HEALTHY
    assert local.paid is False
    cursor = app.providers.get("cursor-acp")
    assert cursor.health.value in {"disconnected", "needs_auth", "healthy", "degraded"}


def test_memory_crud_and_search(app):
    item = app.memory.add(MemoryKind.USER, "Prefers plain English", "Do not talk like a programmer.")
    found = app.memory.search("plain English")
    assert found[0]["id"] == item["id"]
    app.memory.update(item["id"], body="Keep explanations short.")
    app.memory.delete(item["id"])
    assert app.memory.search("plain English") == []


def test_memory_rejects_secrets(app):
    try:
        app.memory.add(MemoryKind.USER, "key", "sk-abcdefghijklmnopqrstuvwxyz1234")
        raise AssertionError("secrets must not be stored")
    except MemoryDenied:
        pass


def test_project_brain(app, jarvis_env):
    from jarvis.paths import workspace_root

    root = workspace_root() / "demo"
    root.mkdir()
    (root / "README.md").write_text("hello", encoding="utf-8")
    brain = app.projects.upsert("demo", str(root), purpose="A demo", architecture="files on disk")
    app.projects.record_decision(brain["id"], "Keep it simple.")
    explained = app.projects.explain(brain["id"])
    assert "demo" in explained.lower()
    listed = app.projects.discover_workspace()
    assert any(p["name"] == "demo" for p in listed)


def test_credentials_never_echo_secret(app):
    view = app.credentials.save_secret("openai", "sk-test-not-a-real-key-123456")
    assert "sk-test" not in str(view)
    assert view["secret_visible"] is False
    listed = app.credentials.list_public()
    assert all("keyring_ref" not in row for row in listed)
