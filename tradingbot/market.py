from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol

import pandas as pd


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def candles_to_dicts(raw: list[list[Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in raw:
        rows.append(
            {
                "timestamp": int(item[0]),
                "open": float(item[1]),
                "high": float(item[2]),
                "low": float(item[3]),
                "close": float(item[4]),
                "volume": float(item[5]),
            }
        )
    return rows


class MarketClient(Protocol):
    def ohlcv(self, symbol: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]: ...

    def ticker_price(self, symbol: str) -> float: ...


class CcxtMarket:
    def __init__(self, api_key: str = "", secret: str = "", sandbox: bool = True) -> None:
        import ccxt

        self.exchange = ccxt.binance(
            {
                "apiKey": api_key or None,
                "secret": secret or None,
                "enableRateLimit": True,
                "options": {"defaultType": "spot"},
            }
        )
        if sandbox and hasattr(self.exchange, "set_sandbox_mode"):
            try:
                self.exchange.set_sandbox_mode(True)
            except Exception:
                pass

    def ohlcv(self, symbol: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]:
        raw = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        return candles_to_dicts(raw)

    def ticker_price(self, symbol: str) -> float:
        ticker = self.exchange.fetch_ticker(symbol)
        return float(ticker["last"])


class PublicBinanceMarket:
    """Public klines. No API key required."""

    INTERVALS = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "4h": "4h",
        "1d": "1d",
        "1w": "1w",
    }

    def __init__(self) -> None:
        import httpx

        self._httpx = httpx

    def _pair(self, symbol: str) -> str:
        return symbol.replace("/", "").upper()

    def ohlcv(self, symbol: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]:
        interval = self.INTERVALS.get(timeframe, "1h")
        url = "https://api.binance.com/api/v3/klines"
        response = self._httpx.get(
            url,
            params={"symbol": self._pair(symbol), "interval": interval, "limit": limit},
            timeout=20.0,
        )
        response.raise_for_status()
        raw = [[row[0], row[1], row[2], row[3], row[4], row[5]] for row in response.json()]
        return candles_to_dicts(raw)

    def ticker_price(self, symbol: str) -> float:
        response = self._httpx.get(
            "https://api.binance.com/api/v3/ticker/price",
            params={"symbol": self._pair(symbol)},
            timeout=20.0,
        )
        response.raise_for_status()
        return float(response.json()["price"])


class FixtureMarket:
    def __init__(self, candles: list[dict[str, Any]] | None = None) -> None:
        self.candles = candles or falling_market()

    def ohlcv(self, symbol: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]:
        return self.candles[-limit:]

    def ticker_price(self, symbol: str) -> float:
        return float(self.candles[-1]["close"])


def falling_market(bars: int = 80, start: float = 100.0) -> list[dict[str, Any]]:
    """A declining tape so RSI finishes oversold — useful for demos and tests."""
    rows: list[dict[str, Any]] = []
    price = start
    ts = 1_700_000_000_000
    for i in range(bars):
        nxt = price * 0.992
        high = max(price, nxt) * 1.001
        low = min(price, nxt) * 0.999
        volume = 12.0 + (i % 5)
        rows.append(
            {
                "timestamp": ts + i * 3_600_000,
                "open": round(price, 4),
                "high": round(high, 4),
                "low": round(low, 4),
                "close": round(nxt, 4),
                "volume": volume,
            }
        )
        price = nxt
    return rows


def rising_market(bars: int = 80, start: float = 100.0) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    price = start
    ts = 1_700_000_000_000
    for i in range(bars):
        nxt = price * 1.008
        high = max(price, nxt) * 1.001
        low = min(price, nxt) * 0.999
        rows.append(
            {
                "timestamp": ts + i * 3_600_000,
                "open": round(price, 4),
                "high": round(high, 4),
                "low": round(low, 4),
                "close": round(nxt, 4),
                "volume": 10.0,
            }
        )
        price = nxt
    return rows


def as_frame(candles: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(candles)
