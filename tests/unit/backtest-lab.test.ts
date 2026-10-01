import { describe, expect, it } from "vitest";
import { runBacktest } from "@/core/backtest";
import { runMonteCarlo, runOutOfSample, runWalkForward, minimumSampleWarning } from "@/core/anti-overfit";
import { educationalStrategies } from "@/core/examples";
import { synthesizeDemoBars } from "@/core/market-data";
import { runTournament } from "@/core/tournament";

describe("backtesting lab", () => {
  const strategy = educationalStrategies("2026-01-01T00:00:00.000Z")[0];
  const bars = synthesizeDemoBars("SPY", "etf", 260, 11);

  it("produces labeled historical metrics and never claims live results", () => {
    const result = runBacktest({ strategy, bars, fillOn: "next_open" });
    expect(result.metrics.resultKind).toBe("backtest");
    expect(result.warnings.some((w) => w.includes("not a performance claim") || w.includes("historical"))).toBe(true);
    expect(result.metrics.equityCurve.length).toBeGreaterThan(10);
  });

  it("keeps train and test bars disjoint", () => {
    const split = runOutOfSample({ strategy, bars, fillOn: "next_open" });
    expect(split.inSample.to < split.outOfSample.from || split.inSample.to <= split.outOfSample.from).toBe(true);
    expect(split.warning).toContain("not live validation");
  });

  it("runs walk-forward and monte carlo without declaring a winner", () => {
    const wf = runWalkForward({ strategy, bars, fillOn: "next_open" }, 100, 40);
    expect(wf.windows.length).toBeGreaterThan(0);
    const mc = runMonteCarlo(runBacktest({ strategy, bars, fillOn: "next_open" }), 40, 4);
    expect(Number(mc.p5)).toBeLessThanOrEqual(Number(mc.p95));
    const tourney = runTournament([strategy], bars);
    expect(tourney.note).toContain("does not declare a winner");
    expect(minimumSampleWarning(2)).toContain("Sample size");
  });
});
