from __future__ import annotations

import os
from pathlib import Path

from tradingbot.db import Store
from tradingbot.market import CcxtMarket, FixtureMarket, PublicBinanceMarket


def data_dir() -> Path:
    raw = os.environ.get("TRADINGBOT_DATA_DIR", "./data")
    path = Path(raw).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def make_store() -> Store:
    return Store(data_dir() / "tradingbot.sqlite")


def make_market():
    mode = os.environ.get("TRADINGBOT_MARKET", "public").lower()
    if mode in {"fixture", "demo", "mock"}:
        return FixtureMarket()
    if mode == "ccxt":
        return CcxtMarket(
            api_key=os.environ.get("BINANCE_API_KEY", ""),
            secret=os.environ.get("BINANCE_SECRET", ""),
            sandbox=os.environ.get("ENABLE_LIVE_TRADING", "false").lower() != "true",
        )
    return PublicBinanceMarket()


def live_trading_enabled() -> bool:
    return os.environ.get("ENABLE_LIVE_TRADING", "false").lower() == "true"
