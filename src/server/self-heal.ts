import { createPaperAccount, type PaperAccountState } from "@/core/paper-broker";
import { DEFAULT_CONSTITUTION_LIMITS } from "@/core/constitution";
import { ids } from "@/core/ids";
import {
  assertHealAllowed,
  isForbiddenHeal,
  planHeal,
  type HealAction,
  type HealFinding,
  type HealReport,
} from "@/core/self-heal";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { migrate } from "@/db/migrate";
import { sqliteTableNames } from "@/db/pg";
import { DEMO_EMAIL, seed, upsertInstruments, upsertMarketDataSources } from "@/db/seed";
import { loadConfig } from "./config";
import { audit } from "./audit";

const STUCK_JOB_MS = 10 * 60 * 1000;
let lastHealAt = 0;
const HEAL_COOLDOWN_MS = 5_000;

function db() {
  return getDb();
}

function parsePaperState(raw: string | null, accountId: string): PaperAccountState | null {
  if (!raw) return createPaperAccount(accountId, "100000");
  try {
    const parsed = JSON.parse(raw) as Partial<PaperAccountState>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      accountId: parsed.accountId ?? accountId,
      currency: parsed.currency ?? "USD",
      cash: typeof parsed.cash === "string" ? parsed.cash : "100000",
      realizedPnl: parsed.realizedPnl ?? "0",
      positions: parsed.positions && typeof parsed.positions === "object" ? parsed.positions : {},
      orders: parsed.orders ?? {},
      fills: parsed.fills ?? [],
      lastReconciledAt: parsed.lastReconciledAt,
    };
  } catch {
    return null;
  }
}

export function diagnoseSelfHeal(userId?: string): HealFinding[] {
  const findings: HealFinding[] = [];
  const sqlite = db();
  const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
    (r) => r.name,
  );
  const expected = sqliteTableNames();
  const missing = expected.filter((name) => !tables.includes(name));
  if (missing.length) {
    findings.push({
      code: "schema.missing",
      severity: "repairable",
      auto: true,
      message: `Missing tables: ${missing.join(", ")}. Migrate will restore them.`,
    });
    return findings;
  }

  const demo = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_EMAIL) as { id: string } | undefined;
  if (!demo) {
    findings.push({
      code: "operator.missing",
      severity: "repairable",
      auto: true,
      message: "Demo operator is missing. Seed will restore the local desk.",
    });
  }

  const instrumentCount = (sqlite.prepare("SELECT COUNT(*) as c FROM instruments").get() as { c: number }).c;
  if (instrumentCount < 4) {
    findings.push({
      code: "instruments.missing",
      severity: "repairable",
      auto: true,
      message: "Instrument list is incomplete.",
    });
  }

  const stuckCutoff = new Date(Date.now() - STUCK_JOB_MS).toISOString();
  const stuck = sqlite
    .prepare("SELECT id FROM jobs WHERE status = 'running' AND (started_at IS NULL OR started_at < ?)")
    .all(stuckCutoff) as Array<{ id: string }>;
  for (const job of stuck) {
    findings.push({
      code: "jobs.stuck",
      severity: "repairable",
      auto: true,
      entityId: job.id,
      message: `Job ${job.id} is stuck in running and will be requeued.`,
    });
  }

  const retryable = sqlite
    .prepare("SELECT id FROM jobs WHERE status = 'failed' AND attempts < 2")
    .all() as Array<{ id: string }>;
  for (const job of retryable) {
    findings.push({
      code: "jobs.retry",
      severity: "repairable",
      auto: true,
      entityId: job.id,
      message: `Failed job ${job.id} still has retry budget.`,
    });
  }

  const exhausted = sqlite
    .prepare("SELECT id FROM jobs WHERE status = 'failed' AND attempts >= 2")
    .all() as Array<{ id: string }>;
  for (const job of exhausted) {
    findings.push({
      code: "jobs.exhausted",
      severity: "needs_human",
      auto: false,
      entityId: job.id,
      message: `Job ${job.id} failed twice. Self-heal will not invent a success.`,
    });
  }

  const userIds = userId
    ? [userId]
    : (sqlite.prepare("SELECT id FROM users").all() as Array<{ id: string }>).map((u) => u.id);

  const cfg = loadConfig();
  for (const uid of userIds) {
    const flags = sqlite.prepare("SELECT * FROM runtime_flags WHERE user_id = ?").get(uid) as
      | {
          display_mode: string;
          live_enabled: number;
          stop_new_trades: number;
        }
      | undefined;
    if (!flags) {
      findings.push({
        code: "flags.missing",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "Runtime flags are missing. Restoring demo/assisted with LIVE off.",
      });
    }

    const live = sqlite.prepare("SELECT * FROM live_control WHERE user_id = ?").get(uid) as
      | { live_enabled: number; armed_until: string | null }
      | undefined;
    if (!live) {
      findings.push({
        code: "live_control.missing",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "Live-control row is missing. Restoring disarmed/off.",
      });
    } else if (live.armed_until && new Date(live.armed_until).getTime() <= Date.now()) {
      findings.push({
        code: "live.arm_expired",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "Live arm window expired. Disarming.",
      });
    }

    if (
      !cfg.liveEnabled &&
      (flags?.display_mode === "live" || flags?.live_enabled === 1 || live?.live_enabled === 1 || live?.armed_until)
    ) {
      findings.push({
        code: "live.fail_closed_drift",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "LIVE is off in the environment but the desk drifted on. Forcing paper and disarm.",
      });
    }

    const constitution = sqlite.prepare("SELECT id FROM constitution_versions WHERE user_id = ? LIMIT 1").get(uid);
    if (!constitution) {
      findings.push({
        code: "constitution.missing",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "Trading Constitution is missing. Restoring the conservative default. AI did not author it.",
      });
    }

    const account = sqlite.prepare("SELECT id, paper_state FROM broker_accounts WHERE user_id = ? ORDER BY created_at LIMIT 1").get(uid) as
      | { id: string; paper_state: string | null }
      | undefined;
    if (!account) {
      findings.push({
        code: "account.missing",
        severity: "repairable",
        auto: true,
        entityId: uid,
        message: "Paper broker account is missing. Restoring a simulated book.",
      });
    } else if (!parsePaperState(account.paper_state, account.id)) {
      findings.push({
        code: "paper_state.corrupt",
        severity: "repairable",
        auto: true,
        entityId: account.id,
        message: "Paper book JSON is corrupt. Rebuilding an empty simulated book. Order history is kept.",
      });
    } else {
      const paper = parsePaperState(account.paper_state, account.id);
      if (paper) {
        const tablePos = sqlite.prepare("SELECT instrument FROM positions WHERE account_id = ?").all(account.id) as Array<{
          instrument: string;
        }>;
        const paperSymbols = Object.keys(paper.positions).filter((s) => Number(paper.positions[s]?.quantity ?? 0) !== 0);
        const missingPos = paperSymbols.filter((s) => !tablePos.some((p) => p.instrument === s));
        if (missingPos.length) {
          findings.push({
            code: "positions.desynced",
            severity: "repairable",
            auto: true,
            entityId: account.id,
            message: `Position table missing ${missingPos.join(", ")}. Syncing from the paper book.`,
          });
        }
      }
    }

    const orphans = sqlite
      .prepare(
        `SELECT e.id FROM expert_attachments e
         LEFT JOIN strategies s ON s.id = e.strategy_id
         WHERE e.user_id = ? AND s.id IS NULL`,
      )
      .all(uid) as Array<{ id: string }>;
    for (const orphan of orphans) {
      findings.push({
        code: "experts.orphan",
        severity: "repairable",
        auto: true,
        entityId: orphan.id,
        message: `Expert ${orphan.id} points at a missing strategy and will be disabled.`,
      });
    }
  }

  return findings;
}

function applyFinding(finding: HealFinding): HealAction {
  assertHealAllowed(finding.code);
  const sqlite = db();
  const now = toIsoUtc();

  switch (finding.code) {
    case "schema.missing":
      migrate();
      return { code: finding.code, applied: true, detail: "Schema migrated." };
    case "operator.missing":
    case "instruments.missing":
      upsertMarketDataSources(sqlite);
      upsertInstruments(sqlite);
      if (finding.code === "operator.missing") {
        return { code: finding.code, applied: true, detail: "Baseline instruments restored. Seed the operator separately." };
      }
      return { code: finding.code, applied: true, detail: "Instrument list restored." };
    case "flags.missing":
      if (finding.entityId) {
        sqlite
          .prepare(
            "INSERT OR IGNORE INTO runtime_flags (user_id, display_mode, trading_mode, live_enabled, autonomous_enabled, stop_new_trades, stop_automation) VALUES (?, 'demo', 'assisted', 0, 0, 0, 0)",
          )
          .run(finding.entityId);
      }
      return { code: finding.code, applied: true, detail: "Runtime flags restored (LIVE off)." };
    case "live_control.missing":
      if (finding.entityId) {
        sqlite
          .prepare(
            "INSERT OR IGNORE INTO live_control (user_id, live_enabled, armed_until, halted, halt_reason, broker_error_streak, updated_at) VALUES (?, 0, NULL, 0, NULL, 0, ?)",
          )
          .run(finding.entityId, now);
      }
      return { code: finding.code, applied: true, detail: "Live-control row restored (disarmed)." };
    case "live.arm_expired":
      if (finding.entityId) {
        sqlite.prepare("UPDATE live_control SET armed_until = NULL, updated_at = ? WHERE user_id = ?").run(now, finding.entityId);
      }
      return { code: finding.code, applied: true, detail: "Expired live arm cleared." };
    case "live.fail_closed_drift":
      if (finding.entityId) {
        sqlite
          .prepare("UPDATE runtime_flags SET display_mode = 'paper', live_enabled = 0 WHERE user_id = ?")
          .run(finding.entityId);
        sqlite
          .prepare("UPDATE live_control SET live_enabled = 0, armed_until = NULL, updated_at = ? WHERE user_id = ?")
          .run(now, finding.entityId);
      }
      return { code: finding.code, applied: true, detail: "Forced paper and disarmed because env LIVE is off." };
    case "constitution.missing":
      if (finding.entityId) {
        const id = ids.constitution();
        sqlite
          .prepare(
            "INSERT INTO constitution_versions (id, user_id, version, payload, authorized_by_user_id, created_at) VALUES (?, ?, 1, ?, ?, ?)",
          )
          .run(
            id,
            finding.entityId,
            JSON.stringify({
              id,
              version: 1,
              createdAt: now,
              authorizedByUserId: finding.entityId,
              ...DEFAULT_CONSTITUTION_LIMITS,
            }),
            finding.entityId,
            now,
          );
      }
      return { code: finding.code, applied: true, detail: "Conservative default constitution restored." };
    case "account.missing":
      if (finding.entityId) {
        const accountId = ids.account();
        sqlite
          .prepare(
            `INSERT INTO broker_accounts (id, user_id, broker, broker_account_ref, environment, display_name, currency, paper_state, last_sync_at, created_at)
             VALUES (?, ?, 'paper', 'PAPER-HEAL', 'paper', 'Internal Paper Account', 'USD', ?, ?, ?)`,
          )
          .run(accountId, finding.entityId, JSON.stringify(createPaperAccount(accountId, "100000")), now, now);
      }
      return { code: finding.code, applied: true, detail: "Paper account restored." };
    case "paper_state.corrupt":
      if (finding.entityId) {
        sqlite
          .prepare("UPDATE broker_accounts SET paper_state = ?, last_sync_at = ? WHERE id = ?")
          .run(JSON.stringify(createPaperAccount(finding.entityId, "100000")), now, finding.entityId);
      }
      return { code: finding.code, applied: true, detail: "Corrupt paper book rebuilt empty (simulated)." };
    case "positions.desynced":
      if (finding.entityId) {
        const account = sqlite.prepare("SELECT paper_state FROM broker_accounts WHERE id = ?").get(finding.entityId) as
          | { paper_state: string }
          | undefined;
        const paper = parsePaperState(account?.paper_state ?? null, finding.entityId);
        if (paper) {
          for (const pos of Object.values(paper.positions)) {
            if (Number(pos.quantity) === 0) continue;
            const existing = sqlite
              .prepare("SELECT id FROM positions WHERE account_id = ? AND instrument = ?")
              .get(finding.entityId, pos.instrument) as { id: string } | undefined;
            if (!existing) {
              sqlite
                .prepare(
                  "INSERT INTO positions (id, account_id, instrument, quantity, average_price, market_price, unrealized_pnl, realized_pnl, updated_at) VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?)",
                )
                .run(
                  ids.position(),
                  finding.entityId,
                  pos.instrument,
                  pos.quantity,
                  pos.averagePrice,
                  pos.averagePrice,
                  pos.realizedPnl,
                  now,
                );
            }
          }
        }
      }
      return { code: finding.code, applied: true, detail: "Positions table synced from paper book." };
    case "jobs.stuck":
    case "jobs.retry":
      if (finding.entityId) {
        sqlite.prepare("UPDATE jobs SET status = 'retry', error = ? WHERE id = ?").run("self-heal requeued", finding.entityId);
      }
      return { code: finding.code, applied: true, detail: `Job ${finding.entityId} requeued.` };
    case "experts.orphan":
      if (finding.entityId) {
        sqlite.prepare("UPDATE expert_attachments SET enabled = 0 WHERE id = ?").run(finding.entityId);
      }
      return { code: finding.code, applied: true, detail: `Orphan expert ${finding.entityId} disabled.` };
    default:
      return { code: finding.code, applied: false, detail: "No automatic repair for this finding." };
  }
}

export async function runSelfHeal(opts: { userId?: string; force?: boolean } = {}): Promise<HealReport> {
  const refused: string[] = [];
  if (!opts.force && Date.now() - lastHealAt < HEAL_COOLDOWN_MS) {
    const findings = diagnoseSelfHeal(opts.userId);
    return {
      checkedAt: toIsoUtc(),
      findings,
      actions: [],
      refused,
      healthy: findings.filter((f) => f.severity !== "info").length === 0,
    };
  }

  migrate();
  upsertMarketDataSources(db());
  upsertInstruments(db());
  await seed();

  const findings = diagnoseSelfHeal(opts.userId);
  const planned = planHeal(findings);
  const actions: HealAction[] = [];
  for (const finding of planned) {
    if (isForbiddenHeal(finding.code)) {
      refused.push(finding.code);
      continue;
    }
    actions.push(applyFinding(finding));
  }

  lastHealAt = Date.now();
  const after = diagnoseSelfHeal(opts.userId);
  const remainingAuto = planHeal(after);
  if (remainingAuto.length) {
    for (const finding of remainingAuto) {
      actions.push(applyFinding(finding));
    }
  }

  const finalFindings = diagnoseSelfHeal(opts.userId);
  const report: HealReport = {
    checkedAt: toIsoUtc(),
    findings: finalFindings,
    actions,
    refused,
    healthy: planHeal(finalFindings).length === 0 && finalFindings.every((f) => f.severity !== "needs_human"),
  };

  try {
    db()
      .prepare("INSERT INTO system_events (id, kind, payload, created_at) VALUES (?, 'self_heal', ?, ?)")
      .run(ids.system(), JSON.stringify({ actions: report.actions, remaining: finalFindings.map((f) => f.code) }), toIsoUtc());
    if (opts.userId && actions.length) {
      audit({ userId: opts.userId, action: "self_heal", entity: "runtime", payload: { actions } });
    }
  } catch {
    // Audit is best-effort if schema is mid-repair.
  }
  return report;
}

export function repairPaperStateOrThrow(accountId: string, raw: string | null): PaperAccountState {
  const parsed = parsePaperState(raw, accountId);
  if (parsed) return parsed;
  const fresh = createPaperAccount(accountId, "100000");
  db()
    .prepare("UPDATE broker_accounts SET paper_state = ?, last_sync_at = ? WHERE id = ?")
    .run(JSON.stringify(fresh), toIsoUtc(), accountId);
  return fresh;
}

export function refuseForbiddenHeal(code: string): never {
  throw new Error(`Self-heal refuses "${code}". That action stays human-gated.`);
}
