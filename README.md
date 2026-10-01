# My Trading Bot

Upload the document that describes how you trade. The bot reads that style, turns it into checkable entry and exit criteria, and will only take a **paper trade** when those criteria are true on the latest candle.

That is the whole product:

1. You write (or already have) a trading style in a PDF, Word file, Markdown file, or pasted text.
2. The compiler extracts the market, timeframe, indicators, comparisons, stops, and size.
3. The desk loads candles, evaluates every compiled rule, and records a paper fill only when the rules pass.

Live exchange orders are **not** sent. This version is a paper desk so you can see the style → criteria → trade path without spending money.

## Start here

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch.sh
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

- Drop your style document on the left, or click **Load “RSI Mean Reversion”** to use the bundled example.
- Read the criteria ticket in the middle. That ticket is the contract the bot is allowed to trade.
- **Try demo tape** runs a falling price series so the RSI example can actually fire a paper buy. **Scan live market** uses public candles (Binance, then Coinbase, then Kraken) and does not need an API key. Reset the paper account before switching from the demo tape to live prices.

You can also compile a file in the terminal:

```bash
python -m tradingbot.cli compile examples/rsi_mean_reversion.md
python -m tradingbot.cli scan examples/rsi_mean_reversion.md --demo
```

## What language the compiler understands

Write the style the way you would explain it to a junior trader. Concrete numbers compile. Vague language is kept as a warning.

Examples that become real rules:

- “I trade Bitcoin on the 1 hour chart”
- “Buy when the 14-period RSI drops below 30 and price is above the 200 EMA”
- “Sell when RSI goes above 70”
- “Stop loss 2%. Take profit 4%.”
- “$10 USDT per trade. One position at a time.”
- “Price crosses above the 50 EMA”
- “MACD line crosses above the signal line”
- “Golden cross”
- “Volume is above average”

If a line cannot be compiled, it still appears on the ticket as **Uncompiled** so you can rewrite it.

## Tests

```bash
pytest -q
```

## Safety

Paper account only. `ENABLE_LIVE_TRADING` is accepted as an environment flag so you can see that live routing is off. Do not treat compiled rules or paper fills as advice.
