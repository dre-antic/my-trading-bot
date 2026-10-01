import { runBacktest } from "./backtest";
import { runMonteCarlo, runOutOfSample, runWalkForward, minimumSampleWarning } from "./anti-overfit";
import type { StrategyDefinition } from "./strategy";
import type { Bar } from "./types";

export interface TournamentRow {
  strategyId: string;
  name: string;
  inSampleReturn: string;
  outOfSampleReturn: string;
  walkForwardMedianTestReturn: string;
  monteCarloP5: string;
  maxDrawdown: string;
  trades: number;
  warnings: string[];
  resultKind: "backtest";
}

export function runTournament(
  strategies: StrategyDefinition[],
  bars: Bar[],
): { rows: TournamentRow[]; note: string } {
  const rows = strategies.map((strategy) => {
    const full = runBacktest({ strategy, bars, fillOn: "next_open" });
    const oos = runOutOfSample({ strategy, bars, fillOn: "next_open" });
    const wf = runWalkForward({ strategy, bars, fillOn: "next_open" }, 120, 40);
    const mc = runMonteCarlo(full, 80, 3);
    const testReturns = wf.windows.map((w) => Number(w.test.metrics.totalReturn)).sort((a, b) => a - b);
    const median = testReturns.length ? testReturns[Math.floor(testReturns.length / 2)].toFixed(4) : "n/a";
    const warnings = [
      ...full.warnings,
      oos.warning,
      wf.note,
      mc.note,
      minimumSampleWarning(full.metrics.trades) ?? "",
    ].filter(Boolean);
    return {
      strategyId: strategy.strategyId,
      name: strategy.name,
      inSampleReturn: oos.inSample.metrics.totalReturn,
      outOfSampleReturn: oos.outOfSample.metrics.totalReturn,
      walkForwardMedianTestReturn: median,
      monteCarloP5: mc.p5,
      maxDrawdown: full.metrics.maxDrawdown,
      trades: full.metrics.trades,
      warnings,
      resultKind: "backtest" as const,
    };
  });
  return {
    rows,
    note: "The tournament reports robustness evidence. It does not declare a winner or a profitable strategy.",
  };
}

