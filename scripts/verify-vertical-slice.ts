import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, resetDbForTests } from "../src/db/client";
import { DEMO_EMAIL, DEMO_PASSWORD, seed } from "../src/db/seed";
import { login } from "../src/server/auth";
import { closePosition, createStrategyVersion, decideCandidate, portfolioOf, riskCheckCandidate, scanStrategy } from "../src/server/trading-service";
import { getDb } from "../src/db/client";

async function main() {
  const file = path.join(os.tmpdir(), `atcc-verify-${Date.now()}.sqlite`);
  resetDbForTests(file);
  await seed();
  const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
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
  const candidate = scanned[0];
  const checked = riskCheckCandidate(user.userId, candidate.candidateId);
  console.log("scan", scanned.length, "risk", checked.risk.decision);
  if (checked.risk.decision === "APPROVED") {
    const decided = decideCandidate(user.userId, candidate.candidateId, "APPROVE");
    console.log("order", decided.orderId);
    const port = portfolioOf(user.userId);
    if (port.positions[0]) closePosition(user.userId, port.positions[0].instrument);
  }
  const journal = getDb().prepare("SELECT COUNT(*) as c FROM journal_entries").get() as { c: number };
  const audits = getDb().prepare("SELECT COUNT(*) as c FROM audit_events").get() as { c: number };
  console.log("journal", journal.c, "audit", audits.c);
  closeDb();
  fs.unlinkSync(file);
  console.log("vertical slice verification complete");
}

void main();
