# Operations runbook

## Start

`npm install && npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npm run dev`

Worker: `npm run dev:worker`

## Health

UI: `/status`  
API: `/api/status` (authenticated)

## Common actions

- Stop new trades: Settings → Stop new trades
- Flatten paper book: type `CLOSE ALL POSITIONS`
- Re-seed: delete `data/atcc.sqlite` and run seed
- Logs: structured console + `system_events` / `audit_events`

## Market data

Settings → Refresh bars, or `POST /api/market-data/refresh`. Demo mode may use labeled synthetic series. Paper/live require cached Stooq/Alpaca bars.

## Laboratory

`/laboratory` creates champion/challenger experiments. Evaluate gates, then promote with the phrase `PROMOTE CHALLENGER`. The challenger becomes APPROVED, never LIVE.

## Notifications

Unconfigured Telegram/Discord/email/web-push channels record `sent=false`. Delivery rows live in `notification_deliveries`.

## Paid services

Leave `AI_*_LIMIT_USD=0` and omit provider keys unless you intend to spend.
