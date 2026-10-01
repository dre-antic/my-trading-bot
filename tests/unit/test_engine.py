from tradingbot.broker import PaperBroker
from tradingbot.compiler import compile_strategy
from tradingbot.engine import run_scan
from tradingbot.market import falling_market, rising_market


def test_paper_buy_then_sell_records_pnl():
    text = """
    # Simple RSI
    BTC/USDT 1 hour
    Entry: Buy when RSI is below 30.
    Exit: Sell when RSI is above 70.
    $10 per trade.
    """
    criteria = compile_strategy(text)
    broker = PaperBroker(starting_cash=1000)
    buy = run_scan(strategy_id="s1", criteria=criteria, candles=falling_market(), broker=broker)
    assert buy.action == "buy"
    assert broker.has_position("BTC/USDT")
    assert broker.cash == 990

    sell = run_scan(strategy_id="s1", criteria=criteria, candles=rising_market(), broker=broker)
    assert sell.action == "sell"
    assert not broker.has_position("BTC/USDT")
    assert sell.trade is not None
    assert sell.trade.pnl is not None
    assert broker.cash != 990


def test_second_entry_blocked_when_max_positions_filled():
    text = """
    BTC/USDT hourly
    Buy when RSI is below 30.
    One position at a time.
    $10 USDT per trade.
    """
    criteria = compile_strategy(text)
    broker = PaperBroker()
    first = run_scan(strategy_id="s1", criteria=criteria, candles=falling_market(), broker=broker)
    assert first.action == "buy"
    again = run_scan(strategy_id="s1", criteria=criteria, candles=falling_market(), broker=broker)
    assert again.action == "wait"
