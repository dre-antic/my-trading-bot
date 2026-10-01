# Disaster recovery

| Failure | Behavior now |
|---|---|
| API process crash | SQLite WAL persists orders, candidates, sessions |
| Worker crash | Jobs remain `queued` / `retry` (max 2 attempts) |
| Broker disconnect | Paper state is local; Alpaca adapter errors instead of fake fills |
| Submit timeout | Reconciliation compares client order ids before retry |
| AI outage | Deterministic desk continues; paid path stays off |
| Market-data outage | Demo provider still labeled DEMO; paper/live must not substitute synthetic silently |
| Duplicate message | Unique `client_order_id` on paper submit |

Open-order state lives in `orders` and in `broker_accounts.paper_state`. After restart, reload paper state from SQLite and reconcile before sending a new order.
