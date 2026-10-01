# Deployment

## Local

See `README.md`. SQLite is created under `data/atcc.sqlite`.

## Docker

```bash
docker compose up --build
```

This starts the web process and a worker sharing a volume. Redis/Postgres profiles exist but are not required.

Environment variables are listed in `.env.example`.

## Cloud

The control UI can run anywhere Node 20+ is available. Heavy jobs should use the worker process so a laptop can be off. Object storage is not wired yet; documents live in SQLite.

## Environments

| Name | Broker | Data |
|---|---|---|
| development | paper | demo/synthetic labeled DEMO |
| staging | paper | demo or Alpaca paper if configured |
| paper | paper / alpaca_paper | never silent synthetic substitution when mode is paper and provider is `synthetic` |
| production | blocked unless `ATCC_LIVE_ENABLED=true` | do not enable without a reviewed live adapter |

Development must not receive production broker credentials.
