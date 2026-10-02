import { describe, expect, it } from "vitest";
import { canPromoteToLive, evaluatePromotionGates, evaluateRobustnessGates } from "@/core/laboratory";

const ready = {
  challengerLifecycle: "PAPER" as const,
  outOfSampleTrades: 12,
  walkForwardWindows: 3,
  maxDrawdownPct: 10,
};

describe("champion/challenger gates", () => {
  it("fails robustness on low sample or early lifecycle", () => {
    const low = evaluateRobustnessGates({ ...ready, outOfSampleTrades: 2, walkForwardWindows: 1, challengerLifecycle: "DRAFT" });
    expect(low.passed).toBe(false);
    expect(low.failures.join(" ")).toMatch(/lifecycle|Out-of-sample|Walk-forward/);
  });

  it("fails promotion without explicit user approval even when robustness passes", () => {
    const robustness = evaluateRobustnessGates(ready);
    expect(robustness.passed).toBe(true);
    const gate = evaluatePromotionGates({ ...ready, userApproved: false });
    expect(gate.passed).toBe(false);
    expect(gate.failures.some((f) => f.includes("User has not approved"))).toBe(true);
  });

  it("passes promotion gates only with evidence plus user approval", () => {
    const gate = evaluatePromotionGates({ ...ready, userApproved: true });
    expect(gate.passed).toBe(true);
  });

  it("never allows laboratory promotion to LIVE", () => {
    expect(canPromoteToLive("PAPER", { passed: true, failures: [], note: "" })).toBe(false);
    expect(canPromoteToLive("LIVE", { passed: true, failures: [], note: "" })).toBe(false);
  });
});
