# Broker adapter guide

`BrokerAdapter` lives in `src/core/broker.ts`.

Implemented:

1. **Internal paper broker** — complete order/fill/position loop. Readiness: `sandbox_only`.
2. **Alpaca paper HTTP client** — `src/server/alpaca.ts`. Readiness: `integration_untested`. Requires keys. Does not fake success.

Reserved, not implemented:

- Interactive Brokers, OANDA, MT5, cTrader, Binance, Coinbase, Kraken

The original `bot.py` used CCXT Binance sandbox. That script is not carried forward; the new adapter interface replaces it.

Universal order fields include user, account, broker, environment, strategy, and strategy version.

Reconciliation: `src/core/reconciliation.ts`. A timeout is not treated as a failure if the broker already has the client order id.
