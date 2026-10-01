import type { BacktestRequest, BacktestResult } from "./backtest";
import type { StrategyDefinition } from "./strategy";
import type { Bar } from "./types";

export interface TradingEngine {
  readonly id: string;
  readonly readiness: "sandbox_only" | "integration_untested" | "production_ready";
  backtest(req: BacktestRequest): BacktestResult;
}

export interface Signal {
  strategyId: string;
  strategyVersion: number;
  instrument: string;
  timestamp: string;
  matched: boolean;
}

export function engineSignals(strategy: StrategyDefinition, bars: Bar[], evaluate: (s: StrategyDefinition, b: Bar[]) => { matched: boolean }): Signal[] {
  if (bars.length < 2) return [];
  const last = bars[bars.length - 1];
  return [
    {
      strategyId: strategy.strategyId,
      strategyVersion: strategy.version,
      instrument: last.instrument,
      timestamp: last.timestamp,
      matched: evaluate(strategy, bars).matched,
    },
  ];
}
