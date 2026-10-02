# Architecture

## Processes

| Process | Role | Status |
|---|---|---|
| Next.js web + API | Control plane, PWA, REST | Implemented |
| Worker (`src/worker`) | Durable SQL job consumer; optional Redis wake-up | Implemented |
| SQLite | Default store for local/dev/test and the app query path | Implemented |
| PostgreSQL | Schema mirror + `migratePostgres(DATABASE_URL)` | Schema available; request path stays SQLite-first |
| Redis | Optional `atcc:jobs` list as wake-up | Wired; SQL remains source of truth |

## Module map

```
src/core        Pure domain: money, constitution, DSL, risk, paper, backtest, AI catalog, LEAN mapping, lab gates
src/db          SQLite schema, Postgres schema, migrate, seed
src/server      Auth, sessions, trading service, Alpaca, jobs, notifications, providers
src/app         Next.js UI + route handlers
src/worker      Background loop
src/ui          Client helpers
```

The trading engine is a TypeScript implementation with a LEAN-compatible export (`toLeanConfig`, `leanStatistics`). LEAN itself is **not** vendored. If `lean` CLI is installed and `ATCC_ENGINE=lean`, `LeanCliEngine` is selected and **refuses to invent LEAN results** until a workspace is configured. See `TRADING_ENGINE.md`.

## Safety pipeline

Every executable proposal is a `TradeCandidate`, then:

1. Strategy compliance (DSL)
2. Portfolio intelligence
3. Deterministic Risk Firewall
4. Human decision (`APPROVE` / `REJECT` / `WATCH`)
5. Broker adapter (paper only in this build)
6. Journal + audit

Research, signal, proposal, approval, and execution are separate states.

## Laboratory

Champion/challenger experiments live in `strategy_experiments`. Robustness gates (OOS trades, walk-forward windows, drawdown, lifecycle) are evaluated separately from human approval. Promotion requires the phrase `PROMOTE CHALLENGER` and sets the challenger to **APPROVED**, never LIVE.

## Multi-tenant boundary

Rows are keyed by `user_id`. API handlers load only the session user. This is application-level isolation, not separate databases.

## Modes

- Display: `demo` | `paper` | `live` (live blocked unless `ATCC_LIVE_ENABLED=true` **and** in-app flag)
- Trading: `research` | `assisted` | `autonomous` (autonomous blocked unless `ATCC_AUTONOMOUS_ENABLED=true`)
- Defaults: LIVE off, AUTONOMOUS off, approval on
