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


class PublicMarket:
    """Public candles. No API key. Tries Binance, then Coinbase, then Kraken."""

    BINANCE_INTERVALS = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "4h": "4h",
        "1d": "1d",
        "1w": "1w",
    }
    COINBASE_GRANULARITY = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400}
    KRAKEN_INTERVALS = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440, "1w": 10080}
    HEADERS = {"User-Agent": "my-trading-bot/0.1"}

    def __init__(self) -> None:
        import httpx

        self._httpx = httpx

    def ohlcv(self, symbol: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]:
        errors: list[str] = []
        for name, loader in (
            ("binance", self._binance),
            ("coinbase", self._coinbase),
            ("kraken", self._kraken),
        ):
            try:
                candles = loader(symbol, timeframe, limit)
                if candles:
                    return candles
            except Exception as exc:
                errors.append(f"{name}: {exc}")
        raise RuntimeError("Could not fetch public candles. " + " | ".join(errors))

    def ticker_price(self, symbol: str) -> float:
        return float(self.ohlcv(symbol, "1h", limit=2)[-1]["close"])

    def _get(self, url: str, params: dict[str, Any] | None = None):
        response = self._httpx.get(url, params=params, timeout=20.0, headers=self.HEADERS)
        response.raise_for_status()
        return response.json()

    def _binance(self, symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
        interval = self.BINANCE_INTERVALS.get(timeframe, "1h")
        payload = self._get(
            "https://api.binance.com/api/v3/klines",
            {"symbol": symbol.replace("/", "").upper(), "interval": interval, "limit": limit},
        )
        raw = [[row[0], row[1], row[2], row[3], row[4], row[5]] for row in payload]
        return candles_to_dicts(raw)

    def _coinbase(self, symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
        granularity = self.COINBASE_GRANULARITY.get(timeframe)
        if granularity is None:
            raise ValueError(f"Coinbase has no {timeframe} candles")
        base, quote = symbol.split("/")
        products = [f"{base}-{quote}"]
        if quote == "USDT":
            products.append(f"{base}-USD")
        last_error: Exception | None = None
        payload = None
        for product in products:
            try:
                payload = self._get(
                    f"https://api.exchange.coinbase.com/products/{product}/candles",
                    {"granularity": granularity},
                )
                break
            except Exception as exc:
                last_error = exc
        if payload is None:
            raise last_error or RuntimeError("Coinbase product not found")
        rows = []
        for row in reversed(payload):
            rows.append(
                {
                    "timestamp": int(row[0]) * 1000,
                    "low": float(row[1]),
                    "high": float(row[2]),
                    "open": float(row[3]),
                    "close": float(row[4]),
                    "volume": float(row[5]),
                }
            )
        return rows[-limit:]

    def _kraken(self, symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
        interval = self.KRAKEN_INTERVALS.get(timeframe, 60)
        base, quote = symbol.split("/")
        kraken_base = "XBT" if base == "BTC" else base
        payload = self._get(
            "https://api.kraken.com/0/public/OHLC",
            {"pair": f"{kraken_base}{quote}", "interval": interval},
        )
        if payload.get("error"):
            raise RuntimeError(", ".join(payload["error"]))
        series = next(value for key, value in payload["result"].items() if key != "last")
        rows = []
        for row in series:
            rows.append(
                {
                    "timestamp": int(row[0]) * 1000,
                    "open": float(row[1]),
                    "high": float(row[2]),
                    "low": float(row[3]),
                    "close": float(row[4]),
                    "volume": float(row[6]),
                }
            )
        return rows[-limit:]


PublicBinanceMarket = PublicMarket


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
