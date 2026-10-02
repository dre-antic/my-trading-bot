import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import { createExperiment, evaluateExperiment, listExperiments, promoteExperiment } from "@/server/laboratory";
import { listStrategies } from "@/server/trading-service";

const tmp = path.join(os.tmpdir(), `atcc-lab-${process.pid}.sqlite`);

describe("laboratory service", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("creates experiments and blocks promotion without gates or the confirmation phrase", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const strategies = listStrategies(user.userId);
    expect(strategies.length).toBeGreaterThan(1);
    const created = createExperiment(user.userId, strategies[0].strategyId, strategies[1].strategyId);
    expect(listExperiments(user.userId)).toHaveLength(1);

    const evaluated = evaluateExperiment(user.userId, created.id, false);
    expect(evaluated.livePromotionAllowed).toBe(false);
    expect(evaluated.gate.passed).toBe(false);

    expect(() => promoteExperiment(user.userId, created.id, "please")).toThrow(/PROMOTE CHALLENGER/);
    expect(() => promoteExperiment(user.userId, created.id, "PROMOTE CHALLENGER")).toThrow(/Promotion blocked|lifecycle|Out-of-sample|Walk-forward|User has not approved/);
  });
});
