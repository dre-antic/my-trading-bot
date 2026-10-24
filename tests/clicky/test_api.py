from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from clicky.server import create_app
from clicky.store import Store


DEMO = [
    {
        "symbol": "BTC",
        "name": "Bitcoin",
        "price": 100.0,
        "change_24h": -5.0,
        "closes": [120 - i for i in range(20)],
        "source": "demo",
    },
    {
        "symbol": "ETH",
        "name": "Ethereum",
        "price": 20.0,
        "change_24h": 1.0,
        "closes": [20] * 20,
        "source": "demo",
    },
    {
        "symbol": "SOL",
        "name": "Solana",
        "price": 10.0,
        "change_24h": 0.2,
        "closes": [10] * 20,
        "source": "demo",
    },
]


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    async def fake_markets(client=None):
        return [dict(item) for item in DEMO]

    monkeypatch.setattr("clicky.server.fetch_markets", fake_markets)
    app = create_app(Store(tmp_path / "clicky.sqlite"))
    return TestClient(app)


def test_health(client: TestClient):
    assert client.get("/api/health").json()["name"] == "clicky"


def test_home_is_the_phone_shell(client: TestClient):
    page = client.get("/")
    assert page.status_code == 200
    assert "Clicky" in page.text
    assert 'id="buy"' in page.text


def test_state_seeds_paper_book(client: TestClient):
    data = client.get("/api/state").json()
    assert data["paper"] is True
    assert data["book"]["cash"] == 10_000
    assert data["advice"]["symbol"] == "BTC"
    assert data["book"]["messages"]


def test_ask_keeps_a_short_reply(client: TestClient):
    data = client.post("/api/ask", json={"message": "What should I do?", "symbol": "BTC"}).json()
    assert data["reply"]
    assert data["book"]["messages"][-1]["role"] == "clicky"


def test_click_buy_then_sell(client: TestClient):
    bought = client.post("/api/click", json={"side": "buy", "symbol": "BTC", "usd": 100}).json()
    assert bought["fill"]["side"] == "buy"
    assert bought["book"]["cash"] == 9900
    assert bought["book"]["lots"][0]["symbol"] == "BTC"

    sold = client.post("/api/click", json={"side": "sell", "symbol": "BTC", "usd": 100}).json()
    assert sold["fill"]["side"] == "sell"
    assert sold["book"]["cash"] == 10_000
    assert sold["book"]["lots"] == []


def test_click_rejects_bad_side(client: TestClient):
    response = client.post("/api/click", json={"side": "yeet", "symbol": "BTC", "usd": 25})
    assert response.status_code == 400


def test_reset_clears_positions(client: TestClient):
    client.post("/api/click", json={"side": "buy", "symbol": "ETH", "usd": 40})
    data = client.post("/api/reset").json()
    assert data["book"]["cash"] == 10_000
    assert data["book"]["lots"] == []
