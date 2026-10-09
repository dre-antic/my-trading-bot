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

## Self-heal

The desk repairs itself on boot, on authenticated requests, and on the worker loop (`src/server/self-heal.ts`).

Automatic:

- Missing schema / instruments / demo operator
- Missing flags, constitution, paper account, live-control row
- Corrupt paper-book JSON (rebuilt empty; order history kept)
- Stuck `running` jobs and failed jobs with retry budget
- Orphan Experts
- Expired live arm
- LIVE display/control drift while `ATCC_LIVE_ENABLED` is false (force paper + disarm)

Never automatic:

- Enable/arm live
- Place an order
- Reset the circuit breaker
- Clear `STOP NEW TRADES`
- Substitute synthetic bars in paper/live

UI: **System → Repair now**. Failed jobs that already used two attempts stay `needs_human`.
