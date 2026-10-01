# Risk management

The Trading Constitution is the highest policy layer. AI cannot edit it.

The Risk Firewall (`src/core/risk-firewall.ts`) is deterministic software. It returns `APPROVED` or `REJECTED` with codes such as:

`TRADE_RISK_LIMIT`, `DAILY_LOSS_LIMIT`, `WEEKLY_LOSS_LIMIT`, `MAX_DRAWDOWN`, `LEVERAGE_LIMIT`, `PORTFOLIO_EXPOSURE`, `INSTRUMENT_EXPOSURE`, `CORRELATED_EXPOSURE`, `ORDER_SIZE`, `SPREAD`, `SLIPPAGE`, `LIQUIDITY`, `STALE_DATA`, `STALE_SIGNAL`, `DUPLICATE_ORDER`, `BUYING_POWER`, `STOP_REQUIRED`, `LIVE_DISABLED`, `AUTONOMOUS_DISABLED`, `EMERGENCY_HALT`.

Position sizing is computed on the server. Editing quantity from the phone re-runs the firewall.

Emergency phrases must match exactly (`CLOSE ALL POSITIONS`, etc.).
