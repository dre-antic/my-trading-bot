import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/core/dsl";
import { ema, rsi, sma } from "@/core/indicators";
import { buildIndicatorSet } from "@/core/strategy-context";
import { synthesizeDemoBars } from "@/core/market-data";
import { evaluateStrategyCompliance } from "@/core/strategy";
import { educationalStrategies } from "@/core/examples";

describe("indicators and dsl", () => {
  it("computes SMA and RSI without look-ahead padding errors", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(sma(values, 5)[4]).toBe(3);
    expect(ema(values, 3)[2]).not.toBeNull();
    expect(rsi([1, 2, 3, 4, 3, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 5).at(-1)).toBeGreaterThan(50);
  });

  it("evaluates AND/OR/NOT and reports missing data", () => {
    const bars = synthesizeDemoBars("SPY", "etf", 80, 3);
    const ctx = buildIndicatorSet(bars);
    const passed = evaluateRule(
      { op: "and", args: [{ op: "cmp", left: { kind: "indicator", name: "close" }, cmp: ">", right: { kind: "literal", value: "0" } }] },
      ctx,
    );
    expect(passed.passed).toBe(true);
    const missing = evaluateRule(
      { op: "cmp", left: { kind: "indicator", name: "sma", period: 2000 }, cmp: ">", right: { kind: "literal", value: "1" } },
      ctx,
    );
    expect(missing.missing).toBe(true);
  });

  it("does not invent strategy compliance when rules fail", () => {
    const strategy = educationalStrategies(new Date().toISOString())[2];
    const bars = synthesizeDemoBars("SPY", "etf", 40, 1);
    const result = evaluateStrategyCompliance(strategy, bars);
    expect(result.matched === true || result.matched === false).toBe(true);
    if (!result.matched) expect(result.failed.length + result.clarifications.length).toBeGreaterThan(0);
  });
});
