import { describe, expect, it } from "vitest";
import { educationalStrategies } from "@/core/examples";
import { synthesizeDemoBars } from "@/core/market-data";
import { LeanCliEngine, NativeEngine, leanStatistics, toLeanConfig } from "@/core/lean-engine";

describe("LEAN-compatible engine", () => {
  const strategy = educationalStrategies("2026-01-01T00:00:00.000Z")[0];
  const bars = synthesizeDemoBars("SPY", "etf", 80, 3);

  it("exports a LEAN-compatible description without claiming LEAN ran", () => {
    const cfg = toLeanConfig(strategy);
    expect(cfg.format).toBe("atcc-lean-compatible-v1");
    expect(cfg.brokerage).toBe("PaperBrokerageModel");
    expect(cfg.universe).toContain("SPY");
    expect(cfg.notes).toMatch(/not vendored/i);
  });

  it("maps native metrics to LEAN statistic names", () => {
    const result = new NativeEngine().backtest({ strategy, bars, fillOn: "next_open" });
    const stats = leanStatistics(result);
    expect(stats["Sharpe Ratio"]).toBe(result.metrics.sharpe);
    expect(stats.engine).toMatch(/native-ts/);
    expect(result.warnings.some((w) => w.includes("native-ts"))).toBe(true);
  });

  it("falls back to native when the CLI is absent", () => {
    const engine = new LeanCliEngine(() => ({ ok: false, output: "" }));
    expect(engine.available()).toBe(false);
    const result = engine.backtest({ strategy, bars, fillOn: "next_open" });
    expect(result.metrics.resultKind).toBe("backtest");
  });

  it("refuses to invent LEAN results when the CLI is present but unconfigured", () => {
    const engine = new LeanCliEngine(() => ({ ok: true, output: "lean 1.0" }));
    expect(engine.available()).toBe(true);
    expect(() => engine.backtest({ strategy, bars, fillOn: "next_open" })).toThrow(/Refusing to invent LEAN results/);
  });
});
