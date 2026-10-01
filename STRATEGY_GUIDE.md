# Strategy guide

A strategy is versioned. Editing creates a new version. Live strategies are never silently mutated.

Lifecycle (do not skip):

`DRAFT → RESEARCH → BACKTESTED → OUT_OF_SAMPLE → WALK_FORWARD → PAPER → APPROVED → LIVE`

Educational fixtures ship as `DRAFT`:

- `edu_trend_following`
- `edu_breakout`
- `edu_mean_reversion`
- `edu_momentum`

These exist to exercise infrastructure. They are **not** claimed profitable.

Import path: paste notes → extraction → interpretation with `stated` / `needs_clarification` → human review → versioned DSL.

Champion/challenger rows can be stored in `strategy_experiments`. Automatic replacement of a live strategy is not implemented and must not be added without user approval.
