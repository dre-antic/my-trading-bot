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

## Paid services

Leave `AI_*_LIMIT_USD=0` and omit provider keys unless you intend to spend.
