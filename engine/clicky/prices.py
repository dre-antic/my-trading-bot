from __future__ import annotations

import time
from typing import Any

import httpx

from clicky.engine import ASSETS

COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"
CACHE_SECONDS = 30.0

DEMO_MARKETS: list[dict[str, Any]] = [
    {
        "symbol": "BTC",
        "name": "Bitcoin",
        "price": 68420.0,
        "change_24h": -1.4,
        "closes": [69200, 69010, 68840, 68720, 68610, 68540, 68420],
        "source": "demo",
    },
    {
        "symbol": "ETH",
        "name": "Ethereum",
        "price": 3320.0,
        "change_24h": 0.8,
        "closes": [3280, 3294, 3301, 3310, 3314, 3318, 3320],
        "source": "demo",
    },
    {
        "symbol": "SOL",
        "name": "Solana",
        "price": 164.2,
        "change_24h": 3.1,
        "closes": [152, 154, 156, 158, 160, 162, 164.2],
        "source": "demo",
    },
]

_cache: dict[str, Any] = {"at": 0.0, "markets": None}


def _sparkline_to_closes(sparkline: dict[str, Any] | None) -> list[float]:
    prices = (sparkline or {}).get("price") or []
    closes = [float(value) for value in prices if value is not None]
    if len(closes) > 48:
        step = max(1, len(closes) // 32)
        closes = closes[::step]
    return closes


def _from_coingecko(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {row.get("id"): row for row in rows}
    markets: list[dict[str, Any]] = []
    for symbol, meta in ASSETS.items():
        row = by_id.get(meta["id"])
        if not row or row.get("current_price") is None:
            continue
        markets.append(
            {
                "symbol": symbol,
                "name": meta["name"],
                "price": float(row["current_price"]),
                "change_24h": (
                    None
                    if row.get("price_change_percentage_24h") is None
                    else float(row["price_change_percentage_24h"])
                ),
                "closes": _sparkline_to_closes(row.get("sparkline_in_7d")),
                "source": "live",
            }
        )
    return markets


async def fetch_markets(client: httpx.AsyncClient | None = None) -> list[dict[str, Any]]:
    now = time.time()
    cached = _cache.get("markets")
    if cached and now - float(_cache["at"]) < CACHE_SECONDS:
        return cached

    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=6.0, headers={"user-agent": "clicky-ai/0.1"})
    try:
        response = await http.get(
            COINGECKO_MARKETS,
            params={
                "vs_currency": "usd",
                "ids": ",".join(asset["id"] for asset in ASSETS.values()),
                "sparkline": "true",
                "price_change_percentage": "24h",
            },
        )
        response.raise_for_status()
        markets = _from_coingecko(response.json())
        if len(markets) != len(ASSETS):
            raise RuntimeError("incomplete market payload")
        _cache["at"] = now
        _cache["markets"] = markets
        return markets
    except Exception:
        if cached:
            return cached
        return [dict(item) for item in DEMO_MARKETS]
    finally:
        if owns_client:
            await http.aclose()


def price_map(markets: list[dict[str, Any]]) -> dict[str, float]:
    return {item["symbol"]: float(item["price"]) for item in markets}


def market_for(markets: list[dict[str, Any]], symbol: str) -> dict[str, Any]:
    symbol = symbol.upper()
    for item in markets:
        if item["symbol"] == symbol:
            return item
    raise KeyError(symbol)
