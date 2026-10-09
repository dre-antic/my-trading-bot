import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import { submitPaperTicket } from "@/server/ticket";
import { portfolioOf } from "@/server/trading-service";

const tmp = path.join(os.tmpdir(), `atcc-fx-${process.pid}.sqlite`);

describe("forex paper lots", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("fills 0.10 EURUSD as a paper market ticket", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const result = submitPaperTicket(user.userId, {
      instrument: "EURUSD",
      side: "buy",
      type: "market",
      quantity: "0.10",
    });
    expect(result.resultKind).toBe("paper");
    expect(portfolioOf(user.userId).positions.some((p) => p.instrument === "EURUSD")).toBe(true);
  });
});
