import { DEFAULT_CONSTITUTION_LIMITS } from "@/core/constitution";
import { educationalStrategies } from "@/core/examples";
import { AGENT_CATALOG } from "@/core/ai";
import { ids } from "@/core/ids";
import { hashPassword } from "@/core/security";
import { toIsoUtc } from "@/core/time";
import { getDb } from "./client";
import { migrate } from "./migrate";

export const DEMO_EMAIL = "demo@local";
export const DEMO_PASSWORD = "CommandCenter!demo";

export async function seed(db = getDb()): Promise<{ userId: string; accountId: string }> {
  migrate(db);
  const now = toIsoUtc();
  upsertMarketDataSources(db);
  upsertInstruments(db);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_EMAIL) as { id: string } | undefined;
  if (existing) {
    const account = db.prepare("SELECT id FROM broker_accounts WHERE user_id = ?").get(existing.id) as { id: string };
    return { userId: existing.id, accountId: account.id };
  }

  const userId = ids.user();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  db.prepare("INSERT INTO users (id, email, password_hash, display_name, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId,
    DEMO_EMAIL,
    passwordHash,
    "Demo Operator",
    "America/New_York",
    now,
  );

  const constitutionId = ids.constitution();
  db.prepare(
    "INSERT INTO constitution_versions (id, user_id, version, payload, authorized_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    constitutionId,
    userId,
    1,
    JSON.stringify({
      id: constitutionId,
      version: 1,
      createdAt: now,
      authorizedByUserId: userId,
      ...DEFAULT_CONSTITUTION_LIMITS,
    }),
    userId,
    now,
  );

  const accountId = ids.account();
  db.prepare(
    `INSERT INTO broker_accounts (id, user_id, broker, broker_account_ref, environment, display_name, currency, paper_state, last_sync_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    accountId,
    userId,
    "paper",
    "PAPER-001",
    "paper",
    "Internal Paper Account",
    "USD",
    JSON.stringify({
      accountId,
      currency: "USD",
      cash: "100000",
      realizedPnl: "0",
      positions: {},
      orders: {},
      fills: [],
    }),
    now,
    now,
  );

  db.prepare(
    "INSERT INTO runtime_flags (user_id, display_mode, trading_mode, live_enabled, autonomous_enabled, stop_new_trades, stop_automation) VALUES (?, ?, ?, 0, 0, 0, 0)",
  ).run(userId, "demo", "assisted");

  upsertInstruments(db);

  upsertMarketDataSources(db);

  for (const agent of AGENT_CATALOG) {
    db.prepare("INSERT OR IGNORE INTO ai_agents (id, name, role, permissions) VALUES (?, ?, ?, ?)").run(
      agent.id,
      agent.name,
      agent.role,
      JSON.stringify(agent.permissions),
    );
  }

  for (const def of educationalStrategies(now)) {
    db.prepare(
      "INSERT INTO strategies (id, user_id, name, description, asset_class, lifecycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(def.strategyId, userId, def.name, def.description, def.assetClass, def.lifecycle, now);
    db.prepare(
      "INSERT INTO strategy_versions (id, strategy_id, version, payload, author, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(ids.strategyVersion(), def.strategyId, def.version, JSON.stringify(def), def.author, now);
  }

  db.prepare("INSERT INTO system_events (id, kind, payload, created_at) VALUES (?, ?, ?, ?)").run(
    ids.system(),
    "seed",
    JSON.stringify({ demoUser: DEMO_EMAIL }),
    now,
  );

  return { userId, accountId };
}

function upsertInstruments(db: ReturnType<typeof getDb>): void {
  const instruments = [
    ["SPY", "etf", "USD", "ARCA", 2, 4, "0.01", "0.0001", "0.0001", "America/New_York", "rth"],
    ["AAPL", "equity", "USD", "NASDAQ", 2, 4, "0.01", "0.0001", "0.0001", "America/New_York", "rth"],
    ["MSFT", "equity", "USD", "NASDAQ", 2, 4, "0.01", "0.0001", "0.0001", "America/New_York", "rth"],
    ["NVDA", "equity", "USD", "NASDAQ", 2, 4, "0.01", "0.0001", "0.0001", "America/New_York", "rth"],
    ["EURUSD", "forex", "USD", "FX", 5, 2, "0.00001", "1000", "1000", "America/New_York", "weekdays"],
    ["GBPUSD", "forex", "USD", "FX", 5, 2, "0.00001", "1000", "1000", "America/New_York", "weekdays"],
    ["USDJPY", "forex", "USD", "FX", 3, 2, "0.001", "1000", "1000", "America/New_York", "weekdays"],
    ["XAUUSD", "forex", "USD", "FX", 2, 2, "0.01", "1", "1", "America/New_York", "weekdays"],
    ["BTC-USD", "crypto", "USD", "CRYPTO", 2, 8, "0.01", "0.00000001", "0.00000001", "UTC", "24x7"],
  ];
  for (const inst of instruments) {
    db.prepare(
      `INSERT OR IGNORE INTO instruments (id, symbol, asset_class, currency, venue, price_decimals, quantity_decimals, tick_size, lot_size, min_quantity, timezone, trading_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ids.instrument(), ...inst);
  }
}

function upsertMarketDataSources(db: ReturnType<typeof getDb>): void {
  const sources: Array<[string, string, string, string]> = [
    ["demo", "demo", "sandbox_only", "Deterministic demo series. Labeled DEMO. Never used as live production data."],
    ["stooq", "stooq", "sandbox_only", "Free Stooq daily CSV. Historical/delayed. Provenance is labeled. Best no-key alternative."],
    ["alpaca_data", "alpaca_data", "integration_untested", "Requires Alpaca keys. Refuses to invent bars when keys or the API are missing."],
  ];
  for (const [id, provider, readiness, notes] of sources) {
    db.prepare("INSERT OR IGNORE INTO market_data_sources (id, provider, readiness, notes) VALUES (?, ?, ?, ?)").run(
      id,
      provider,
      readiness,
      notes,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seed().then((r) => {
    console.log("seeded", r);
  });
}
