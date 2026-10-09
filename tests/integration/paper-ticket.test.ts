import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "@/db/client";
import { seed, DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { login } from "@/server/auth";
import { submitPaperTicket, submitLiveTicket, attachExpert } from "@/server/ticket";
import { enableLiveTrading, armLiveSession } from "@/server/live-control";
import { emergency, portfolioOf } from "@/server/trading-service";
import { LIVE_PHRASES } from "@/core/live-safety";

const tmp = path.join(os.tmpdir(), `atcc-ticket-${process.pid}.sqlite`);

describe("paper ticket and live refusal", () => {
  beforeEach(async () => {
    resetDbForTests(tmp);
    await seed();
  });
  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  });

  it("fills a human paper ticket without live keys", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const result = submitPaperTicket(user.userId, {
      instrument: "SPY",
      side: "buy",
      type: "market",
      quantity: "1",
    });
    expect(result.resultKind).toBe("paper");
    expect(result.orderId).toBeTruthy();
    const port = portfolioOf(user.userId);
    expect(port.positions.some((p) => p.instrument === "SPY")).toBe(true);
  });

  it("refuses a live ticket while LIVE is off", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    await expect(
      submitLiveTicket(user.userId, {
        instrument: "SPY",
        side: "buy",
        type: "market",
        quantity: "1",
        stopLoss: "99",
        livePhrase: LIVE_PHRASES.place,
      }),
    ).rejects.toThrow(/LIVE|armed|phrase|enabled/i);
  });

  it("refuses enable-live with the example session secret", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(() => enableLiveTrading(user.userId, LIVE_PHRASES.enable)).toThrow(/SESSION_SECRET|ATCC_LIVE_ENABLED|phrase/i);
  });

  it("disarms live from the emergency phrase", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const res = emergency(user.userId, "DISARM_LIVE", "DISARM LIVE");
    expect(res.ok).toBe(true);
  });

  it("attaches an expert to a chart symbol", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const attached = attachExpert(user.userId, "edu_trend_following", "SPY");
    expect(attached.id).toBeTruthy();
  });

  it("cannot arm live without in-app enable", async () => {
    const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(() => armLiveSession(user.userId, LIVE_PHRASES.arm)).toThrow();
  });
});
