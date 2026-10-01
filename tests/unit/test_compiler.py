from tradingbot.compiler import compile_strategy


RSI_STYLE = """
# RSI Mean Reversion

I only trade Bitcoin (BTC/USDT) on the 1 hour chart.

## Entry

Buy when the 14-period RSI drops below 30 and price is above the 200 EMA.

## Exit

Sell when RSI goes above 70.
Stop loss 2%.
Take profit 4%.

## Risk

$10 USDT per trade.
One position at a time.
"""


EMA_STYLE = """
# EMA Trend Follow

Markets: ETH/USDT
Timeframe: 4 hour

## Entry

Enter long when price crosses above the 50 EMA and the MACD line crosses above the signal line.

## Exit

Exit when price crosses below the 50 EMA.
Stop loss 1.5%.
Risk reward 1:2.

## Risk

25 USDT per trade.
Maximum 1 position.
"""


def test_rsi_document_becomes_entry_criteria():
    criteria = compile_strategy(RSI_STYLE, filename="rsi.md")
    assert criteria.name == "RSI Mean Reversion"
    assert criteria.symbols == ["BTC/USDT"]
    assert criteria.timeframe == "1h"
    assert len(criteria.entry.conditions) == 2
    rsi = next(c for c in criteria.entry.conditions if c.indicator == "rsi")
    assert rsi.period == 14
    assert rsi.operator == "<"
    assert rsi.value == 30
    ema = next(c for c in criteria.entry.conditions if c.compare_indicator == "ema")
    assert ema.compare_period == 200
    assert ema.operator == ">"
    assert criteria.exit.conditions[0].indicator == "rsi"
    assert criteria.exit.conditions[0].operator == ">"
    assert criteria.risk.stop_loss_pct == 2
    assert criteria.risk.take_profit_pct == 4
    assert criteria.risk.quote_amount == 10
    assert criteria.risk.max_open_positions == 1
    assert criteria.confidence > 0.5


def test_ema_trend_and_risk_reward():
    criteria = compile_strategy(EMA_STYLE)
    assert criteria.symbols == ["ETH/USDT"]
    assert criteria.timeframe == "4h"
    assert any(c.operator == "crosses_above" and c.compare_indicator == "ema" for c in criteria.entry.conditions)
    assert any(c.indicator == "macd_line" for c in criteria.entry.conditions)
    assert any(c.operator == "crosses_below" for c in criteria.exit.conditions)
    assert criteria.risk.stop_loss_pct == 1.5
    assert criteria.risk.take_profit_pct == 3.0
    assert criteria.risk.quote_amount == 25


def test_oversold_language_and_golden_cross():
    text = """
    Trade solana on the daily chart.
    Buy the dip when RSI is oversold.
    I also take the golden cross.
    Sell when it is overbought.
    """
    criteria = compile_strategy(text)
    assert criteria.symbols == ["SOL/USDT"]
    assert criteria.timeframe == "1d"
    assert any("oversold" in c.description for c in criteria.entry.conditions)
    assert any("golden cross" in c.description for c in criteria.entry.conditions)
    assert any("overbought" in c.description for c in criteria.exit.conditions)


def test_english_rules_mention_the_compiled_checks():
    criteria = compile_strategy(RSI_STYLE)
    blob = " ".join(criteria.english_rules())
    assert "BTC/USDT" in blob
    assert "1h" in blob
    assert "RSI(14) is below 30" in blob
    assert "stop loss 2%" in blob.lower()


def test_empty_document_is_rejected():
    try:
        compile_strategy("   ")
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "empty" in str(exc).lower()
