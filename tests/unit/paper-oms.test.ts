import { describe, expect, it } from "vitest";
import { createPaperAccount, matchPaperOrders, submitPaperOrder } from "@/core/paper-broker";
import { canTransitionOrder } from "@/core/oms";
import { reconcile, timeoutDoesNotMeanFailure } from "@/core/reconciliation";

describe("paper broker and oms", () => {
  it("fills a market buy and reduces cash", () => {
    let state = createPaperAccount("acct", "10000");
    const submitted = submitPaperOrder(state, {
      userId: "u",
      accountId: "acct",
      instrument: "SPY",
      side: "buy",
      type: "market",
      quantity: "2",
      expectedPrice: "100",
      now: new Date("2026-01-02T15:00:00Z"),
    });
    state = matchPaperOrders(submitted.state, [{ instrument: "SPY", bid: "99", ask: "100", last: "100", timestamp: "2026-01-02T15:00:00Z" }], new Date("2026-01-02T15:00:01Z"), "0");
    const order = Object.values(state.orders)[0];
    expect(order.status).toBe("filled");
    expect(state.positions.SPY.quantity).toBe("2");
    expect(Number(state.cash)).toBe(9800);
  });

  it("does not fill a buy limit below the ask", () => {
    let state = createPaperAccount("acct", "10000");
    const submitted = submitPaperOrder(state, {
      userId: "u",
      accountId: "acct",
      instrument: "SPY",
      side: "buy",
      type: "limit",
      quantity: "1",
      limitPrice: "90",
      now: new Date(),
    });
    state = matchPaperOrders(submitted.state, [{ instrument: "SPY", bid: "99", ask: "100", last: "100", timestamp: new Date().toISOString() }], new Date());
    expect(Object.values(state.orders)[0].status).toBe("accepted");
    expect(state.positions.SPY).toBeUndefined();
  });

  it("forbids illegal order transitions", () => {
    expect(canTransitionOrder("filled", "submitted")).toBe(false);
    expect(canTransitionOrder("accepted", "filled")).toBe(true);
  });

  it("does not treat a timeout as failure if the broker has the order", () => {
    const report = reconcile(
      { orders: [{ clientOrderId: "clord_1", status: "submitted" } as never], positions: [] },
      { orders: [{ clientOrderId: "clord_1", status: "accepted" } as never], positions: [] },
    );
    expect(timeoutDoesNotMeanFailure(report, "clord_1")).toBe(true);
    expect(report.statusMismatches[0].broker).toBe("accepted");
  });
});
