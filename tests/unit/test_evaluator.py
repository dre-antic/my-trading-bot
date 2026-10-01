from tradingbot.compiler import compile_strategy
from tradingbot.evaluator import evaluate_strategy
from tradingbot.market import falling_market, rising_market
from tests.unit.test_compiler import RSI_STYLE


def test_rsi_style_enters_on_falling_tape():
    criteria = compile_strategy(RSI_STYLE)
    evaluation = evaluate_strategy(criteria, falling_market())
    assert evaluation.price > 0
    rsi_result = next(r for r in evaluation.entry_results if "RSI" in r.description and "below" in r.description)
    assert rsi_result.passed
    # Falling tape is below the 200 EMA, so the trend filter should block the long.
    ema_result = next(r for r in evaluation.entry_results if "EMA" in r.description)
    assert ema_result.passed is False
    assert evaluation.entry_ready is False


def test_rsi_only_enters_when_all_entry_rules_pass():
    text = """
    Trade BTC/USDT on the 1 hour chart.
    Entry: Buy when the 14-period RSI drops below 30.
    Exit: Sell when RSI goes above 70.
    """
    criteria = compile_strategy(text)
    evaluation = evaluate_strategy(criteria, falling_market())
    assert evaluation.entry_ready is True
    assert all(r.passed for r in evaluation.entry_results)


def test_exit_on_overbought_with_open_position():
    text = """
    Trade BTC/USDT hourly.
    Entry: Buy when RSI is below 30.
    Exit: Sell when RSI is above 70.
    Stop loss 2%. Take profit 4%.
    """
    criteria = compile_strategy(text)
    position = {"entry_price": 50.0, "amount": 1, "symbol": "BTC/USDT"}
    evaluation = evaluate_strategy(criteria, rising_market(), position=position)
    assert evaluation.exit_ready is True
    assert evaluation.take_profit_hit is True
