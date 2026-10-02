PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constitution_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  authorized_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, version)
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies(id),
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(strategy_id, version)
);

CREATE TABLE IF NOT EXISTS strategy_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  strategy_id TEXT,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_rules (
  id TEXT PRIMARY KEY,
  strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
  field TEXT NOT NULL,
  source_text TEXT,
  interpretation TEXT,
  confidence TEXT NOT NULL,
  expr TEXT
);

CREATE TABLE IF NOT EXISTS strategy_experiments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  champion_strategy_id TEXT,
  challenger_strategy_id TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_deployments (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies(id),
  strategy_version INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL,
  currency TEXT NOT NULL,
  venue TEXT NOT NULL,
  price_decimals INTEGER NOT NULL,
  quantity_decimals INTEGER NOT NULL,
  tick_size TEXT NOT NULL,
  lot_size TEXT NOT NULL,
  min_quantity TEXT NOT NULL,
  timezone TEXT NOT NULL,
  trading_hours TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_data_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  readiness TEXT NOT NULL,
  notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS broker_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  broker TEXT NOT NULL,
  broker_account_ref TEXT,
  environment TEXT NOT NULL,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  paper_state TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS broker_credentials_metadata (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES broker_accounts(id),
  label TEXT NOT NULL,
  has_key INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES broker_accounts(id),
  instrument TEXT NOT NULL,
  quantity TEXT NOT NULL,
  average_price TEXT NOT NULL,
  market_price TEXT NOT NULL,
  unrealized_pnl TEXT NOT NULL,
  realized_pnl TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES broker_accounts(id),
  broker TEXT NOT NULL,
  environment TEXT NOT NULL,
  strategy_id TEXT,
  strategy_version INTEGER,
  candidate_id TEXT,
  client_order_id TEXT NOT NULL UNIQUE,
  broker_order_id TEXT,
  instrument TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  tif TEXT NOT NULL,
  quantity TEXT NOT NULL,
  filled_quantity TEXT NOT NULL,
  limit_price TEXT,
  stop_price TEXT,
  status TEXT NOT NULL,
  expected_price TEXT,
  reject_reason TEXT,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fills (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  instrument TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity TEXT NOT NULL,
  price TEXT NOT NULL,
  fee TEXT NOT NULL,
  filled_at TEXT NOT NULL,
  simulated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_reviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES trade_candidates(id),
  decision TEXT NOT NULL,
  actor TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  candidate_id TEXT,
  decision TEXT NOT NULL,
  violations TEXT NOT NULL,
  constitution_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backtests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backtest_runs (
  id TEXT PRIMARY KEY,
  backtest_id TEXT NOT NULL REFERENCES backtests(id),
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS optimization_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS walk_forward_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monte_carlo_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_regimes (
  id TEXT PRIMARY KEY,
  instrument TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  used_llm INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd TEXT NOT NULL,
  task TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_evidence (
  id TEXT PRIMARY KEY,
  ai_run_id TEXT NOT NULL REFERENCES ai_runs(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  candidate_id TEXT,
  order_id TEXT,
  strategy_id TEXT,
  strategy_version INTEGER,
  thesis TEXT NOT NULL,
  entry_price TEXT,
  stop_price TEXT,
  target_price TEXT,
  actual_entry TEXT,
  actual_exit TEXT,
  result TEXT,
  regime TEXT,
  ai_reasoning TEXT NOT NULL,
  user_decision TEXT,
  execution_quality TEXT,
  user_notes TEXT,
  result_kind TEXT NOT NULL,
  simulated INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES broker_accounts(id),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  logs TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS market_bar_cache (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  payload TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_control (
  user_id TEXT PRIMARY KEY,
  live_enabled INTEGER NOT NULL DEFAULT 0,
  armed_until TEXT,
  halted INTEGER NOT NULL DEFAULT 0,
  halt_reason TEXT,
  broker_error_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expert_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_flags (
  user_id TEXT PRIMARY KEY,
  display_mode TEXT NOT NULL,
  trading_mode TEXT NOT NULL,
  live_enabled INTEGER NOT NULL DEFAULT 0,
  autonomous_enabled INTEGER NOT NULL DEFAULT 0,
  stop_new_trades INTEGER NOT NULL DEFAULT 0,
  stop_automation INTEGER NOT NULL DEFAULT 0
);
