# Trading engine

## Decision

QuantConnect LEAN is Apache-2.0 and is the preferred *reference* for event-driven backtests and live glue. This repository does **not** embed LEAN (C# / large runtime). A native TypeScript engine implements the product path so the desk is testable without a .NET host.

Interface:

```
TradingEngine
  backtest(request) -> metrics + trades
```

Implemented:

- `NativeEngine` (`src/core/lean-engine.ts`) wraps `runBacktest` and tags warnings with `Engine=native-ts`.
- `toLeanConfig` exports an `atcc-lean-compatible-v1` description (universe, timeframe, stops, sizing).
- `leanStatistics` maps ATCC metrics onto common LEAN statistic names.
- `LeanCliEngine` probes `lean --version`. If the CLI is missing it falls back to native. If the CLI is present but no LEAN project workspace is configured, it **throws** rather than inventing LEAN results.
- `selectTradingEngine()` returns `LeanCliEngine` only when `ATCC_ENGINE=lean` **and** the CLI is available.

Look-ahead: signals are evaluated on the closed window. Optional fill is `next_open` (default in lab runs) to reduce close-to-close leakage.

Do not document LEAN as a live integrated execution engine. The mapping is compatible; the runtime is native unless a real LEAN workspace is wired later.
