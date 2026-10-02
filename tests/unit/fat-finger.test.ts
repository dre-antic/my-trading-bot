import { describe, expect, it } from "vitest";
import { fatFingerDeviationPct, isFatFingerPrice } from "@/core/fat-finger";

describe("fat-finger price check", () => {
  it("allows prices within 10% of last", () => {
    expect(isFatFingerPrice("100", "109")).toBe(false);
    expect(Number(fatFingerDeviationPct("100", "109"))).toBeCloseTo(9);
  });

  it("rejects prices more than 10% away", () => {
    expect(isFatFingerPrice("100", "111")).toBe(true);
    expect(isFatFingerPrice("1.1000", "1.2500")).toBe(true);
  });

  it("does not fire when a price is omitted", () => {
    expect(isFatFingerPrice("100", undefined)).toBe(false);
    expect(isFatFingerPrice(undefined, "111")).toBe(false);
  });
});
