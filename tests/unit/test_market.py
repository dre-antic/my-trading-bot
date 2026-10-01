from tradingbot.market import PublicMarket, falling_market


def test_falls_back_when_binance_is_blocked(monkeypatch):
    market = PublicMarket()
    monkeypatch.setattr(market, "_binance", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("451")))
    monkeypatch.setattr(market, "_coinbase", lambda *args, **kwargs: falling_market()[-10:])
    candles = market.ohlcv("BTC/USDT", "1h")
    assert len(candles) == 10
    assert candles[-1]["close"] > 0
