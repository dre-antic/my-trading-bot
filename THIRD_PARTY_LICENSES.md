# Third-party licenses

This application is MIT. Dependencies keep their own licenses.

## Runtime / direct (npm)

| Project | License | Use |
|---|---|---|
| Next.js | MIT | Web + API |
| React | MIT | UI |
| lightweight-charts | Apache-2.0 | Chart engine (TradingView attribution logo on chart) |
| decimal.js | MIT | Money/quantity |
| zod | MIT | Schema validation |
| better-sqlite3 | MIT / BSD-style (see package) | Local database |
| iron-session | MIT | Cookies |
| nanoid | MIT | IDs |
| lucide-react | ISC | Icons (dependency present; pages use CSS) |
| mammoth | BSD-2-Clause | DOCX (available, import UI currently uses pasted text) |
| pdf-parse | MIT | PDF (available, import UI currently uses pasted text) |
| pg | MIT | Optional PostgreSQL migrate client |
| ioredis | MIT | Optional Redis job wake-up |

## External data (not vendored)

| Source | Access | How used |
|---|---|---|
| Stooq daily CSV | Public HTTP CSV | Historical bars with provenance; no SDK copied |
| Alpaca paper / data HTTP | User keys | Adapter + contract tests against fixture JSON |

## Research references — not vendored

| Project | License (as commonly published) | How used |
|---|---|---|
| QuantConnect LEAN | Apache-2.0 | Architecture reference only |
| Hummingbot | Apache-2.0 | Connector/adapter concepts |
| NautilusTrader | LGPL-3.0 | Concepts only; no code copied |
| Freqtrade | GPLv3 | Concepts only; no code copied |
| yt-trade-distill / pinescript-agents | various | Media→spec pattern only; no code copied |
| LumiBot | GPL-family (verify before any copy) | Agent-role ideas only; no code copied |
| VectorBT | Apache-2.0 / permissive family — verify at pin time | Metric ideas |
| Jesse | MIT | Backtest metric ideas |
| Backtrader | GPLv3 | Concepts only; no code copied |

Do not copy GPL or Commons-Clause code into this tree. If a future LEAN adapter vendors LEAN, keep it isolated and preserve Apache-2.0 notices.

License review date: 2026-10-01. Re-check upstream LICENSE files before any copy/paste of foreign source.
