import { runBacktest, type BacktestRequest, type BacktestResult } from "./backtest";
import type { Bar } from "./types";

export interface SplitResult {
  inSample: BacktestResult;
  outOfSample: BacktestResult;
  warning: string;
}

export function trainTestSplit(bars: Bar[], trainPct = 0.7): { train: Bar[]; test: Bar[] } {
  const cut = Math.max(1, Math.floor(bars.length * trainPct));
  return { train: bars.slice(0, cut), test: bars.slice(cut) };
}

export function runOutOfSample(req: BacktestRequest, trainPct = 0.7): SplitResult {
  const { train, test } = trainTestSplit(req.bars, trainPct);
  const inSample = runBacktest({ ...req, bars: train, resultKind: "backtest" });
  const outOfSample = runBacktest({ ...req, bars: test, resultKind: "backtest" });
  return {
    inSample,
    outOfSample,
    warning:
      "Out-of-sample results still share the same strategy definition. They are not live validation and must not be described as proven.",
  };
}

export interface WalkForwardWindow {
  trainFrom: string;
  trainTo: string;
  testFrom: string;
  testTo: string;
  train: BacktestResult;
  test: BacktestResult;
}

export function runWalkForward(
  req: BacktestRequest,
  trainBars = 180,
  testBars = 60,
): { windows: WalkForwardWindow[]; note: string } {
  const windows: WalkForwardWindow[] = [];
  for (let start = 0; start + trainBars + testBars <= req.bars.length; start += testBars) {
    const train = req.bars.slice(start, start + trainBars);
    const test = req.bars.slice(start + trainBars, start + trainBars + testBars);
    windows.push({
      trainFrom: train[0].timestamp,
      trainTo: train[train.length - 1].timestamp,
      testFrom: test[0].timestamp,
      testTo: test[test.length - 1].timestamp,
      train: runBacktest({ ...req, bars: train }),
      test: runBacktest({ ...req, bars: test }),
    });
  }
  return {
    windows,
    note: "Walk-forward analysis reports robustness across successive windows. It is not a profitability guarantee.",
  };
}

export interface MonteCarloResult {
  iterations: number;
  endingEquities: string[];
  p5: string;
  p50: string;
  p95: string;
  worst: string;
  note: string;
}

export function runMonteCarlo(result: BacktestResult, iterations = 200, seed = 1): MonteCarloResult {
  const pnls = result.trades.map((t) => Number(t.pnl));
  const endings: number[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < iterations; i += 1) {
    const shuffled = shuffle(pnls, rand);
    endings.push(Number(result.metrics.startingEquity) + shuffled.reduce((a, b) => a + b, 0));
  }
  endings.sort((a, b) => a - b);
  return {
    iterations,
    endingEquities: endings.map((n) => n.toFixed(2)),
    p5: percentile(endings, 0.05).toFixed(2),
    p50: percentile(endings, 0.5).toFixed(2),
    p95: percentile(endings, 0.95).toFixed(2),
    worst: endings[0]?.toFixed(2) ?? "0",
    note: "Monte Carlo reshuffles historical trade P/L. It does not create new market information.",
  };
}

export function minimumSampleWarning(trades: number, min = 30): string | null {
  if (trades < min) {
    return `Only ${trades} trades. Sample size is below ${min}; do not treat metrics as stable.`;
  }
  return null;
}

export function parameterSensitivity(
  run: (value: number) => BacktestResult,
  values: number[],
): Array<{ value: number; totalReturn: string; maxDrawdown: string; trades: number }> {
  return values.map((value) => {
    const r = run(value);
    return {
      value,
      totalReturn: r.metrics.totalReturn,
      maxDrawdown: r.metrics.maxDrawdown,
      trades: r.metrics.trades,
    };
  });
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}
