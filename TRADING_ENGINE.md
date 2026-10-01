# Trading engine

## Decision

QuantConnect LEAN is Apache-2.0 and is the preferred *reference* for event-driven backtests and live glue. This repository does **not** embed LEAN (C# / large runtime). A native TypeScript engine implements the first vertical slice so the product is testable without a .NET host.

Interface conceptually:

```
TradingEngine
  evaluate(strategy, bars) -> signals
  backtest(request) -> metrics + trades
  paper(account, orders, quotes) -> fills
```

Implemented in `src/core/backtest.ts`, `src/core/dsl.ts`, `src/core/paper-broker.ts`.

## Look-ahead

Signals are evaluated on the closed window. Optional fill is `next_open` (default in lab runs) to reduce close-to-close leakage.

## Future LEAN adapter

A LEAN adapter can be added behind the same strategy definition. Until that adapter exists, do not document LEAN as integrated.
