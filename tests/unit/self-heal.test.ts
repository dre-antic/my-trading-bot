import { describe, expect, it } from "vitest";
import { assertHealAllowed, isForbiddenHeal, isRecoverableRuntimeError, planHeal } from "@/core/self-heal";

describe("self-heal policy", () => {
  it("never plans live, arm, breaker reset, or order placement", () => {
    expect(isForbiddenHeal("enable_live")).toBe(true);
    expect(isForbiddenHeal("arm_live")).toBe(true);
    expect(isForbiddenHeal("place_order")).toBe(true);
    expect(isForbiddenHeal("reset_circuit_breaker")).toBe(true);
    expect(() => assertHealAllowed("enable_live")).toThrow(/human-gated/);
    expect(
      planHeal([
        { code: "jobs.stuck", severity: "repairable", auto: true, message: "stuck" },
        { code: "jobs.exhausted", severity: "needs_human", auto: false, message: "done" },
      ]).map((f) => f.code),
    ).toEqual(["jobs.stuck"]);
  });

  it("recognizes recoverable runtime errors for a one-shot retry", () => {
    expect(isRecoverableRuntimeError("no such table: live_control")).toBe(true);
    expect(isRecoverableRuntimeError("Trading Constitution is missing")).toBe(true);
    expect(isRecoverableRuntimeError("invalid credentials")).toBe(false);
  });
});
