import { describe, expect, it } from "vitest";
import { createPaperAccount, submitPaperOrder } from "@/core/paper-broker";
import { assertNoFakeProductionData } from "@/core/market-data";

describe("failure conditions", () => {
  it("rejects duplicate in-flight client order ids", () => {
    const state = createPaperAccount("acct", "10000");
    const first = submitPaperOrder(state, {
      userId: "u",
      accountId: "acct",
      instrument: "SPY",
      side: "buy",
      type: "limit",
      quantity: "1",
      limitPrice: "1",
      clientOrderId: "clord_dup",
      now: new Date(),
    });
    expect(() =>
      submitPaperOrder(first.state, {
        userId: "u",
        accountId: "acct",
        instrument: "SPY",
        side: "buy",
        type: "market",
        quantity: "1",
        clientOrderId: "clord_dup",
        now: new Date(),
      }),
    ).toThrow(/duplicate/);
  });

  it("refuses synthetic data substitution in paper/live", () => {
    expect(() => assertNoFakeProductionData("paper", "synthetic")).toThrow(/synthetic/);
    expect(() => assertNoFakeProductionData("live", "synthetic")).toThrow(/synthetic/);
  });
});
