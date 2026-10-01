import type { RuleExpr } from "./dsl";
import type { StrategyDefinition } from "./strategy";

function indicator(name: string, period?: number) {
  return { kind: "indicator" as const, name, period };
}
function lit(value: string) {
  return { kind: "literal" as const, value };
}

const smaCross: RuleExpr = {
  op: "crosses_above",
  left: indicator("sma", 20),
  right: indicator("sma", 50),
};

const smaCrossDown: RuleExpr = {
  op: "crosses_below",
  left: indicator("sma", 20),
  right: indicator("sma", 50),
};

const rsiOversold: RuleExpr = {
  op: "and",
  args: [
    { op: "cmp", left: indicator("rsi", 14), cmp: "<", right: lit("30") },
    { op: "cmp", left: indicator("close"), cmp: "<=", right: indicator("bb_lower") },
  ],
};

const rsiExit: RuleExpr = {
  op: "cmp",
  left: indicator("rsi", 14),
  cmp: ">",
  right: lit("50"),
};

const breakoutEntry: RuleExpr = {
  op: "cmp",
  left: indicator("close"),
  cmp: ">",
  right: indicator("resistance"),
};

const breakoutExit: RuleExpr = {
  op: "cmp",
  left: indicator("close"),
  cmp: "<",
  right: indicator("sma", 20),
};

const momentumEntry: RuleExpr = {
  op: "and",
  args: [
    { op: "cmp", left: indicator("close"), cmp: ">", right: indicator("sma", 50) },
    { op: "cmp", left: indicator("rsi", 14), cmp: ">", right: lit("55") },
    { op: "cmp", left: indicator("adx", 14), cmp: ">", right: lit("20") },
  ],
};

const momentumExit: RuleExpr = {
  op: "or",
  args: [
    { op: "cmp", left: indicator("rsi", 14), cmp: "<", right: lit("45") },
    { op: "crosses_below", left: indicator("close"), right: indicator("sma", 50) },
  ],
};

export function educationalStrategies(now: string): StrategyDefinition[] {
  const base = {
    author: "system",
    createdAt: now,
    sourceDocumentIds: [],
    educational: true,
    lifecycle: "DRAFT" as const,
    compatibleRegimes: ["any"],
    positionSizing: { method: "percent_account_risk" as const, riskPct: "0.1" },
    stop: { kind: "percent" as const, value: "2" },
    target: { kind: "rr" as const, value: "2" },
    timeoutBars: 30,
  };

  return [
    {
      ...base,
      strategyId: "edu_trend_following",
      version: 1,
      name: "Educational Trend Following",
      description: "Infrastructure test: SMA 20/50 crossover. Not a profitability claim.",
      assetClass: "equity",
      instruments: ["SPY"],
      timeframe: "1d",
      direction: "long",
      entry: smaCross,
      exit: smaCrossDown,
    },
    {
      ...base,
      strategyId: "edu_breakout",
      version: 1,
      name: "Educational Breakout",
      description: "Infrastructure test: close above recent resistance. Not a profitability claim.",
      assetClass: "equity",
      instruments: ["SPY"],
      timeframe: "1d",
      direction: "long",
      entry: breakoutEntry,
      exit: breakoutExit,
    },
    {
      ...base,
      strategyId: "edu_mean_reversion",
      version: 1,
      name: "Educational Mean Reversion",
      description: "Infrastructure test: RSI oversold plus lower Bollinger band. Not a profitability claim.",
      assetClass: "equity",
      instruments: ["SPY"],
      timeframe: "1d",
      direction: "long",
      entry: rsiOversold,
      exit: rsiExit,
    },
    {
      ...base,
      strategyId: "edu_momentum",
      version: 1,
      name: "Educational Momentum",
      description: "Infrastructure test: price above SMA50, RSI, and ADX filter. Not a profitability claim.",
      assetClass: "crypto",
      instruments: ["BTC-USD"],
      timeframe: "1d",
      direction: "long",
      entry: momentumEntry,
      exit: momentumExit,
    },
  ];
}
