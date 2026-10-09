import { runBacktest, type BacktestRequest, type BacktestResult } from "./backtest";
import type { StrategyDefinition } from "./strategy";
import type { TradingEngine } from "./trading-engine";

export interface LeanAlgorithmConfig {
  format: "atcc-lean-compatible-v1";
  name: string;
  language: "Python";
  brokerage: "PaperBrokerageModel";
  universe: string[];
  timeframe: string;
  parameters: Record<string, string>;
  notes: string;
}

export function toLeanConfig(strategy: StrategyDefinition): LeanAlgorithmConfig {
  return {
    format: "atcc-lean-compatible-v1",
    name: strategy.name,
    language: "Python",
    brokerage: "PaperBrokerageModel",
    universe: strategy.instruments,
    timeframe: strategy.timeframe,
    parameters: {
      stopKind: strategy.stop.kind,
      stopValue: strategy.stop.value ?? "",
      targetKind: strategy.target.kind,
      targetValue: strategy.target.value ?? "",
      sizing: strategy.positionSizing.method,
      riskPct: strategy.positionSizing.riskPct ?? "",
    },
    notes:
      "This is a LEAN-compatible description exported from ATCC. LEAN itself is not vendored. If the lean CLI is installed, LeanCliEngine can invoke it; otherwise NativeEngine runs the same strategy definition.",
  };
}

export class NativeEngine implements TradingEngine {
  readonly id = "native-ts";
  readonly readiness = "sandbox_only" as const;
  backtest(req: BacktestRequest): BacktestResult {
    const result = runBacktest(req);
    return { ...result, warnings: [...result.warnings, "Engine=native-ts (LEAN-compatible mapping)."] };
  }
}

export class LeanCliEngine implements TradingEngine {
  readonly id = "lean-cli";
  readonly readiness = "integration_untested" as const;

  constructor(private readonly runner: (cmd: string) => { ok: boolean; output: string } = defaultLeanProbe) {}

  available(): boolean {
    return this.runner("lean --version").ok;
  }

  backtest(req: BacktestRequest): BacktestResult {
    if (!this.available()) {
      return new NativeEngine().backtest({
        ...req,
      });
    }
    const probe = this.runner("lean backtest --help");
    if (!probe.ok) return new NativeEngine().backtest(req);
    throw new Error("lean CLI is present but live invocation is disabled until a project workspace is configured. Refusing to invent LEAN results.");
  }
}

function defaultLeanProbe(cmd: string): { ok: boolean; output: string } {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const output = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).toString();
    return { ok: true, output };
  } catch {
    return { ok: false, output: "" };
  }
}

export function selectTradingEngine(): TradingEngine {
  const lean = new LeanCliEngine();
  if (process.env.ATCC_ENGINE === "lean" && lean.available()) return lean;
  return new NativeEngine();
}

export function leanStatistics(result: BacktestResult): Record<string, string> {
  return {
    "Total Return": `${result.metrics.totalReturn}%`,
    "Sharpe Ratio": result.metrics.sharpe,
    "Drawdown": `${result.metrics.maxDrawdown}%`,
    "Win Rate": `${result.metrics.winRate}%`,
    "Profit-Loss Ratio": result.metrics.profitFactor,
    "Total Trades": String(result.metrics.trades),
    engine: "native-ts mapped to LEAN statistic names",
  };
}
