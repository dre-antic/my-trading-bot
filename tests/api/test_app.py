from fastapi.testclient import TestClient

from tradingbot.app import create_app
from tests.unit.test_compiler import RSI_STYLE


def test_upload_compile_demo_scan(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGBOT_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    created = client.post("/api/strategies/from-text", json={"text": RSI_STYLE, "filename": "rsi.md"})
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["criteria"]["symbols"] == ["BTC/USDT"]
    assert body["english"]
    strategy_id = body["id"]

    # Full RSI+EMA style should not buy a falling tape (price is under the 200 EMA).
    blocked = client.post(f"/api/strategies/{strategy_id}/scan?demo=true")
    assert blocked.status_code == 200
    assert blocked.json()["action"] in {"wait", "blocked"}

    simple = client.post(
        "/api/strategies/from-text",
        json={
            "text": "BTC/USDT 1h\nEntry: Buy when RSI is below 30.\nExit: Sell when RSI is above 70.\n$10 per trade.",
            "filename": "simple.md",
        },
    )
    simple_id = simple.json()["id"]
    fired = client.post(f"/api/strategies/{simple_id}/scan?demo=true")
    assert fired.status_code == 200, fired.text
    payload = fired.json()
    assert payload["action"] == "buy"
    assert payload["trade"]["side"] == "buy"
    assert payload["evaluation"]["entry_ready"] is True

    desk = client.get("/api/desk")
    assert desk.json()["trades"]
    assert desk.json()["broker"]["cash"] < 10000


def test_examples_are_bundled(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGBOT_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())
    examples = client.get("/api/examples")
    assert examples.status_code == 200
    slugs = {item["slug"] for item in examples.json()}
    assert "rsi_mean_reversion" in slugs
