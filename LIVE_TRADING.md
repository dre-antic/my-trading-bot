# Live trading (fail-closed)

This desk can send real-money orders. It will not do so unless every gate below is true. Defaults are **off**. This environment never places live fills during development.

Adapters are **integration-untested**, not claimed production-ready. You accept broker, market, and software risk.

## What “safe as possible” means here

Retail analogue of a FINRA 15c3-5-style pre-trade control: constitution limits, risk firewall, fat-finger 10% band, kill switch, distinct live vs paper hosts/keys, circuit breaker after 3 broker errors, and a 15-minute arm window. AI never gets a live API token and cannot type the confirmation phrases for you.

This is not a guarantee against loss. Markets can gap through stops. Brokers can reject or delay. Your keys can leak if you mishandle `.env`.

## Gate stack (all required)

1. `ATCC_LIVE_ENABLED=true` in the process environment
2. `SESSION_SECRET` is at least 32 characters and **not** the example/dev default
3. In Settings, type exactly `ENABLE LIVE TRADING`
4. Display mode becomes `live`
5. Type exactly `ARM LIVE SESSION` (expires in 15 minutes)
6. On the Terminal ticket, set Execution to Live and type exactly `PLACE LIVE ORDER`
7. Distinct live keys, allowlisted live hosts only
8. Risk Firewall `APPROVED` (stops, size, hours, fat-finger, drawdown, …)
9. Fresh non-synthetic market data (demo bars are refused)
10. Circuit breaker not halted; stop-new-trades off; not research/autonomous

One-click Buy/Sell on the chart is **paper only**. There is no one-click live.

## Brokers

| Adapter | Host | Money |
|---|---|---|
| Internal paper | none | Simulated |
| Alpaca paper | `https://paper-api.alpaca.markets` | Simulated |
| Alpaca live | `https://api.alpaca.markets` only | Real (equities/crypto) |
| OANDA practice | `https://api-fxpractice.oanda.com` | Simulated |
| OANDA live | `https://api-fxtrade.oanda.com` only | Real (forex) |

Paper keys must not equal live keys. A live order to a paper/practice host is rejected.

## How you turn it on (personal steps)

1. Create **Alpaca live** keys (not paper) and/or an **OANDA live** token. Keep paper keys in separate env vars.
2. Put keys only in `.env` on a machine you control. Never commit them. Never paste them into the AI desk.
3. Generate a long `SESSION_SECRET` (32+ random characters).
4. Set `ATCC_LIVE_ENABLED=true`. Leave `ATCC_AUTONOMOUS_ENABLED=false`.
5. Use a real market-data path (`MARKETDATA_PROVIDER=alpaca` with data keys, or refresh Stooq/Alpaca so bars are current). Live refuses demo/synthetic series.
6. Restart the app. Sign in. Open **Settings**.
7. Type `ENABLE LIVE TRADING`, then `ARM LIVE SESSION`.
8. Open **Terminal**. Set Execution to Live. Fill volume, stop, optional target. Type `PLACE LIVE ORDER`. Submit.
9. If anything looks wrong: banner **Kill switch** (disarms live and stops new trades), or type `DISABLE LIVE TRADING`.

Autonomous mode cannot arm or place live orders. Candidate Approve on Opportunities always uses the **paper** broker. Experts only create candidates.

## Kill switch

- Banner **Kill switch** → `DISARM LIVE` + `STOP NEW TRADES`
- Settings: `DISARM LIVE`, `DISABLE LIVE TRADING`, `CLOSE ALL POSITIONS` (paper book)
- Three consecutive live broker errors trip the circuit breaker until you type `RESET CIRCUIT BREAKER`

## What still stays off unless you change it

- `ATCC_AUTONOMOUS_ENABLED` — keep false
- Live modify-order APIs — disabled until an adapter is marked production-ready
- Silent synthetic data in paper/live
