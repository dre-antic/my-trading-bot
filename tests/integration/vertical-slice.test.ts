import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import {
  closePosition,
  createStrategyVersion,
  decideCandidate,
  listCandidates,
  portfolioOf,
  riskCheckCandidate,
  scanStrategy,
} from "@/server/trading-service";
import { getDb } from "@/db/client";

const tmp = path.join(os.tmpdir(), `atcc-slice-${process.pid}.sqlite`);

describe("vertical slice", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("logs in, scans, risk-checks, paper-executes, closes, and journals", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(user.email).toBe(DEMO_EMAIL);

    const slice = createStrategyVersion(user.userId, {
      name: "Slice Probe",
      description: "Infrastructure path test. Not a profitability claim.",
      assetClass: "etf",
      instruments: ["SPY"],
      timeframe: "1d",
      direction: "long",
      entry: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: ">", right: { kind: "literal", value: "0" } },
      exit: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: "<", right: { kind: "literal", value: "0" } },
      stop: { kind: "percent", value: "2" },
      target: { kind: "rr", value: "2" },
      positionSizing: { method: "percent_account_risk", riskPct: "0.1" },
      compatibleRegimes: ["any"],
      lifecycle: "DRAFT",
      sourceDocumentIds: [],
      educational: true,
    });
    const scanned = scanStrategy(user.userId, slice.strategyId);
    expect(scanned.length).toBeGreaterThan(0);
    const candidate = scanned[0];
    const checked = riskCheckCandidate(user.userId, candidate.candidateId);
    expect(["APPROVED", "REJECTED"]).toContain(checked.risk.decision);

    if (checked.risk.decision === "REJECTED") {
      throw new Error(`slice unexpectedly risk-rejected: ${JSON.stringify(checked.risk.violations)}`);
    }

    const decided = decideCandidate(user.userId, candidate.candidateId, "APPROVE");
    expect(decided.orderId).toBeTruthy();
    const after = portfolioOf(user.userId);
    expect(after.positions.length).toBeGreaterThan(0);
    closePosition(user.userId, after.positions[0].instrument);
    const closed = portfolioOf(user.userId);
    expect(closed.positions.length).toBe(0);
    const journal = getDb().prepare("SELECT * FROM journal_entries WHERE user_id = ?").all(user.userId) as Array<{ result_kind: string; simulated: number }>;
    expect(journal.length).toBeGreaterThan(0);
    expect(journal[0].result_kind).toBe("paper");
    expect(journal[0].simulated).toBe(1);
    expect(listCandidates(user.userId)[0].status).toBe("EXECUTED");
  });
});
