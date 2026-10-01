import pandas as pd

from tradingbot.indicators import add_indicators
from tradingbot.market import falling_market, rising_market


def test_falling_market_makes_rsi_oversold():
    df = add_indicators(pd.DataFrame(falling_market()))
    rsi = float(df["rsi_14"].iloc[-1])
    assert rsi < 30


def test_rising_market_makes_rsi_overbought():
    df = add_indicators(pd.DataFrame(rising_market()))
    rsi = float(df["rsi_14"].iloc[-1])
    assert rsi > 70


def test_ema_tracks_close():
    df = add_indicators(pd.DataFrame(rising_market()))
    assert df["ema_50"].iloc[-1] > df["ema_50"].iloc[20]
