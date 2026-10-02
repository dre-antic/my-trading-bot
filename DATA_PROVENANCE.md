# Data provenance

Every bar carries:

`source`, `provider`, `retrievedAt`, `dataTimestamp`, `freshness` (`CURRENT` | `HISTORICAL` | `STALE` | `UNKNOWN`).

## Providers

| Provider | Source label | Production claim |
|---|---|---|
| Demo synthetic | `demo-synthetic` / `demo` | Sandbox only. Labeled DEMO. |
| Stooq daily CSV | `stooq-csv` / `stooq` | Free historical/delayed. Best no-key alternative. |
| Alpaca Market Data | `alpaca-bars` / `alpaca_data` | Requires keys. Refuses to invent bars. Integration-untested. |

`assertNoFakeProductionData` blocks silent synthetic substitution when display mode is `paper` or `live`. Those modes must refresh Stooq/Alpaca into `market_bar_cache` first (`POST /api/market-data/refresh` or the `market_data_refresh` job).

Fundamental and news engines currently report “feed not configured” rather than inventing numbers.
