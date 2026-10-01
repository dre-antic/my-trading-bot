# Architecture

## Processes

| Process | Role | Status |
|---|---|---|
| Next.js web + API | Control plane, PWA, REST | Implemented |
| Worker (`src/worker`) | Durable job table consumer | Implemented |
| SQLite | Default store for local/dev/test | Implemented |
| PostgreSQL | Compose profile for production-shaped deploys | Schema not yet ported; do not claim ready |
| Redis | Optional queue | Not wired; jobs persist in SQLite |

## Module map

```
src/core        Pure domain: money, constitution, DSL, risk, paper, backtest, AI catalog
src/db          SQLite schema, migrate, seed
src/server      Auth, sessions, trading service, Alpaca adapter, jobs
src/app         Next.js UI + route handlers
src/worker      Background loop
src/ui          Client helpers
```

The trading engine is a TypeScript port inspired by LEAN/Hummingbot *concepts* (universal order, connector interface, evented fills). LEAN is **not** vendored. See `TRADING_ENGINE.md`.

## Safety pipeline

Every executable proposal is a `TradeCandidate`, then:

1. Strategy compliance (DSL)
2. Portfolio intelligence
3. Deterministic Risk Firewall
4. Human decision (`APPROVE` / `REJECT` / `WATCH`)
5. Broker adapter (paper only in this build)
6. Journal + audit

Research, signal, proposal, approval, and execution are separate states.

## Multi-tenant boundary

Rows are keyed by `user_id`. API handlers load only the session user. This is application-level isolation, not separate databases.

## Modes

- Display: `demo` | `paper` | `live` (live blocked unless `ATCC_LIVE_ENABLED=true` **and** in-app flag)
- Trading: `research` | `assisted` | `autonomous` (autonomous blocked unless `ATCC_AUTONOMOUS_ENABLED=true`)
- Defaults: LIVE off, AUTONOMOUS off, approval on
