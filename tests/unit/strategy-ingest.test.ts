import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import { confirmIngest, ingestStrategyUpload } from "@/server/strategy-ingest";
import { listExperts } from "@/server/ticket";

const tmp = path.join(os.tmpdir(), `atcc-ingest-${process.pid}.sqlite`);
const fixture = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/rsi-mean-reversion.md"));

describe("strategy ingest", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("turns a markdown upload into a draft strategy that can attach as an Expert", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const result = await ingestStrategyUpload(user.userId, "rsi-mean-reversion.md", fixture);
    expect(result.strategyId).toMatch(/^str_/);
    expect(result.compiled.definition.instruments).toContain("EURUSD");
    expect(result.usedLlm).toBe(false);
    const confirmed = confirmIngest(user.userId, result.documentId, { attach: true, symbol: "EURUSD" });
    expect(confirmed.attached?.id).toBeTruthy();
    const experts = listExperts(user.userId) as Array<{ strategy_id: string; symbol: string }>;
    expect(experts.some((e) => e.strategy_id === result.strategyId && e.symbol === "EURUSD")).toBe(true);
  });
});
