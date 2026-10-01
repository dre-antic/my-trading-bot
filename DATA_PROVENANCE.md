# Data provenance

Every bar carries:

`source`, `provider`, `retrievedAt`, `dataTimestamp`, `freshness` (`CURRENT` | `HISTORICAL` | `STALE` | `UNKNOWN`).

Demo bars are `source: demo-synthetic`. Production/paper mode must not silently substitute that series (`assertNoFakeProductionData`).

Fundamental and news engines currently report “feed not configured” rather than inventing numbers.
