import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import { diagnoseSelfHeal, refuseForbiddenHeal, runSelfHeal } from "@/server/self-heal";
import { loadPaper, portfolioOf } from "@/server/trading-service";
import { toIsoUtc } from "@/core/time";

const tmp = path.join(os.tmpdir(), `atcc-heal-${process.pid}.sqlite`);

describe("self-heal repairs", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("rebuilds a corrupt paper book and still loads a portfolio", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const { account } = loadPaper(user.userId);
    getDb().prepare("UPDATE broker_accounts SET paper_state = ? WHERE id = ?").run("{not-json", account.id);
    const report = await runSelfHeal({ userId: user.userId, force: true });
    expect(report.actions.some((a) => a.code === "paper_state.corrupt" && a.applied)).toBe(true);
    const port = portfolioOf(user.userId);
    expect(Number(port.cash)).toBeGreaterThan(0);
  });

  it("requeues a stuck running job", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    getDb()
      .prepare(
        "INSERT INTO jobs (id, user_id, kind, status, progress, logs, payload, created_at, started_at, attempts) VALUES (?, ?, 'backtest', 'running', 0, '', '{}', ?, ?, 1)",
      )
      .run("job_stuck", user.userId, toIsoUtc(), "2000-01-01T00:00:00.000Z");
    const report = await runSelfHeal({ userId: user.userId, force: true });
    expect(report.actions.some((a) => a.code === "jobs.stuck" && a.applied)).toBe(true);
    const row = getDb().prepare("SELECT status FROM jobs WHERE id = 'job_stuck'").get() as { status: string };
    expect(row.status).toBe("retry");
  });

  it("forces paper when env LIVE is off but the desk drifted to live", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    getDb().prepare("UPDATE runtime_flags SET display_mode = 'live', live_enabled = 1 WHERE user_id = ?").run(user.userId);
    getDb()
      .prepare(
        "INSERT OR REPLACE INTO live_control (user_id, live_enabled, armed_until, halted, halt_reason, broker_error_streak, updated_at) VALUES (?, 1, ?, 0, NULL, 0, ?)",
      )
      .run(user.userId, new Date(Date.now() + 60_000).toISOString(), toIsoUtc());
    const report = await runSelfHeal({ userId: user.userId, force: true });
    expect(report.actions.some((a) => a.code === "live.fail_closed_drift" && a.applied)).toBe(true);
    const flags = getDb().prepare("SELECT display_mode, live_enabled FROM runtime_flags WHERE user_id = ?").get(user.userId) as {
      display_mode: string;
      live_enabled: number;
    };
    expect(flags.display_mode).not.toBe("live");
    expect(flags.live_enabled).toBe(0);
  });

  it("refuses to enable live as a heal action", () => {
    expect(() => refuseForbiddenHeal("enable_live")).toThrow(/human-gated/);
    const findings = diagnoseSelfHeal();
    expect(findings.every((f) => !f.code.includes("enable"))).toBe(true);
  });

  it("disables an expert attached to a deleted strategy", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    getDb()
      .prepare("INSERT INTO expert_attachments (id, user_id, strategy_id, symbol, enabled, created_at) VALUES (?, ?, 'missing_strat', 'SPY', 1, ?)")
      .run("exp_orphan", user.userId, toIsoUtc());
    const report = await runSelfHeal({ userId: user.userId, force: true });
    expect(report.actions.some((a) => a.code === "experts.orphan" && a.applied)).toBe(true);
    const row = getDb().prepare("SELECT enabled FROM expert_attachments WHERE id = 'exp_orphan'").get() as { enabled: number };
    expect(row.enabled).toBe(0);
  });
});
