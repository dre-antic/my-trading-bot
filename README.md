# AI Trading Command Center

A personal AI-assisted trading research, decision-support, portfolio, and **human-approved paper execution** desk.

This is not “LLM predicts market → BUY”.

```
market data → scanner → strategy engine → research desk → candidate
→ strategy compliance → portfolio analysis → deterministic risk firewall
→ execution validation → user approval → paper broker → journal → learning lab
```

**LIVE trading is off. Autonomous trading is off. User approval is on.**

The original repository contained a 70-line Binance RSI script, later replaced by an unrelated video studio. This branch implements the trading product the repository was named for.

## What works now

- Login and session auth (seeded demo operator)
- Trading Constitution (versioned, AI-immutable)
- Strategy DSL, versioning, educational examples
- Document/notes import with SOURCE vs INTERPRETATION
- Deterministic indicators, regime classifier, bull/bear desk
- Trade candidates with full structured fields
- Position sizing (server-side)
- Risk Firewall (deterministic approve/reject)
- Internal paper broker, OMS, fills, positions, reconciliation helper
- Backtest, out-of-sample, walk-forward, Monte Carlo, strategy tournament
- Journal, alerts, audit trail, emergency controls
- Next.js PWA command center (phone-sized navigation included)
- Multi-agent desk catalog (15 roles). Default provider is deterministic, not a paid LLM
- Alpaca **paper** HTTP adapter (real client, not marked production-ready; needs your keys)

## What is explicitly not claimed

- No production-ready live broker
- No guaranteed profit, winning strategy, or “validated” edge
- Educational strategies are infrastructure tests only
- Demo market data is labeled DEMO and is synthetic
- Paid AI stays off unless you configure a key and a budget

## Launch

```bash
npm install
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts
npm run dev
```

Open http://127.0.0.1:3000

Demo login:

- email: `demo@local`
- password: `CommandCenter!demo`

Optional worker:

```bash
npm run dev:worker
```

Tests:

```bash
npm test
npm run verify:slice
npm run build
```

## Paper account

The seeded **Internal Paper Account** starts with 100,000 USD simulated cash. All fills are labeled simulated.

To use Alpaca paper later, create a paper key at Alpaca, set `ALPACA_PAPER_KEY` / `ALPACA_PAPER_SECRET`, and keep `ATCC_LIVE_ENABLED=false`. The adapter is integration-untested and will not invent a successful response if Alpaca is unreachable.

## Safety

AI processes cannot call arbitrary broker APIs, change the Constitution, raise risk limits, or place live orders. See `SECURITY.md` and `RISK_MANAGEMENT.md`.
