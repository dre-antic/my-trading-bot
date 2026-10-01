import { z } from "zod";
import { evaluateRule, explainRuleTree, RuleExprSchema, type RuleExpr } from "./dsl";
import { buildIndicatorSet } from "./strategy-context";
import type { AssetClass, Bar, Direction, RegimeLabel, SizingMethod, StrategyLifecycle } from "./types";

export const PositionSizingSpecSchema = z.object({
  method: z.enum(["fixed_quantity", "fixed_dollar_risk", "percent_account_risk", "atr", "portfolio_risk"]),
  riskPct: z.string().optional(),
  fixedQuantity: z.string().optional(),
  fixedRisk: z.string().optional(),
  atrMultiplier: z.string().optional(),
});

export const StrategyDefinitionSchema = z.object({
  strategyId: z.string(),
  version: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  assetClass: z.enum(["equity", "etf", "forex", "crypto", "future", "option", "other"]),
  instruments: z.array(z.string()),
  timeframe: z.string(),
  direction: z.enum(["long", "short", "both"]),
  entry: RuleExprSchema,
  exit: RuleExprSchema,
  stop: z.object({
    kind: z.enum(["percent", "atr", "absolute", "rule"]),
    value: z.string().optional(),
    rule: RuleExprSchema.optional(),
  }),
  target: z.object({
    kind: z.enum(["percent", "atr", "rr", "absolute", "rule"]),
    value: z.string().optional(),
    rule: RuleExprSchema.optional(),
  }),
  filters: RuleExprSchema.optional(),
  invalidation: RuleExprSchema.optional(),
  timeoutBars: z.number().int().positive().optional(),
  positionSizing: PositionSizingSpecSchema,
  compatibleRegimes: z.array(z.string()),
  lifecycle: z.enum([
    "DRAFT",
    "RESEARCH",
    "BACKTESTED",
    "OUT_OF_SAMPLE",
    "WALK_FORWARD",
    "PAPER",
    "APPROVED",
    "LIVE",
    "PAUSED",
    "RETIRED",
  ]),
  author: z.string(),
  createdAt: z.string(),
  sourceDocumentIds: z.array(z.string()),
  educational: z.boolean(),
});

export type StrategyDefinition = z.infer<typeof StrategyDefinitionSchema>;
export type PositionSizingSpec = z.infer<typeof PositionSizingSpecSchema>;

export interface ComplianceResult {
  matched: boolean;
  ambiguous: boolean;
  satisfied: Array<{ rule: string; passed: boolean }>;
  failed: Array<{ rule: string; passed: boolean }>;
  clarifications: string[];
}

export function evaluateStrategyCompliance(
  strategy: StrategyDefinition,
  bars: Bar[],
  account = { cash: 0, equity: 0, positionQty: 0 },
): ComplianceResult {
  const ctx = buildIndicatorSet(bars, account);
  const entry = evaluateRule(strategy.entry, ctx);
  const filters = strategy.filters ? evaluateRule(strategy.filters, ctx) : { passed: true, missing: false, reason: "no filters" };
  const invalid = strategy.invalidation
    ? evaluateRule(strategy.invalidation, ctx)
    : { passed: false, missing: false, reason: "no invalidation" };

  const rows = [
    ...explainRuleTree(strategy.entry, ctx).map((r) => ({ ...r, group: "entry" })),
    ...(strategy.filters ? explainRuleTree(strategy.filters, ctx).map((r) => ({ ...r, group: "filter" })) : []),
  ];

  const clarifications: string[] = [];
  if (entry.missing) clarifications.push("Entry rule could not be evaluated with available data.");
  if (filters.missing) clarifications.push("Filter rule could not be evaluated with available data.");

  const matched = entry.passed && filters.passed && !invalid.passed && !entry.missing && !filters.missing;
  return {
    matched,
    ambiguous: clarifications.length > 0,
    satisfied: rows.filter((r) => r.passed && !r.missing).map((r) => ({ rule: r.rule, passed: true })),
    failed: rows.filter((r) => !r.passed || r.missing).map((r) => ({ rule: r.rule, passed: false })),
    clarifications,
  };
}

export function computeStopTarget(
  strategy: StrategyDefinition,
  entry: number,
  atrValue: number | null,
  direction: Direction,
): { stop: number; target: number } | { error: string } {
  const sign = direction === "long" ? 1 : -1;
  let stopDistance: number | null = null;
  let targetDistance: number | null = null;

  if (strategy.stop.kind === "percent") {
    stopDistance = entry * (Number(strategy.stop.value ?? "0") / 100);
  } else if (strategy.stop.kind === "atr") {
    if (atrValue == null) return { error: "ATR stop requires ATR data" };
    stopDistance = atrValue * Number(strategy.stop.value ?? "2");
  } else if (strategy.stop.kind === "absolute") {
    const abs = Number(strategy.stop.value ?? "0");
    return finish(entry, abs, targetFrom(strategy, entry, Math.abs(entry - abs), atrValue), direction);
  } else {
    return { error: "Rule-based stops require explicit human-defined prices before execution." };
  }

  targetDistance = targetFrom(strategy, entry, stopDistance, atrValue);
  if (stopDistance == null || targetDistance == null || stopDistance <= 0 || targetDistance <= 0) {
    return { error: "Stop or target is not fully specified. The system will not invent missing prices." };
  }
  const stop = entry - sign * stopDistance;
  const target = entry + sign * targetDistance;
  return { stop, target };
}

function targetFrom(
  strategy: StrategyDefinition,
  entry: number,
  stopDistance: number,
  atrValue: number | null,
): number | null {
  if (strategy.target.kind === "percent") return entry * (Number(strategy.target.value ?? "0") / 100);
  if (strategy.target.kind === "atr") {
    if (atrValue == null) return null;
    return atrValue * Number(strategy.target.value ?? "3");
  }
  if (strategy.target.kind === "rr") return stopDistance * Number(strategy.target.value ?? "2");
  if (strategy.target.kind === "absolute") return Math.abs(Number(strategy.target.value ?? "0") - entry);
  return null;
}

function finish(entry: number, stop: number, targetDistance: number | null, direction: Direction) {
  if (targetDistance == null) return { error: "Target is not fully specified." as const };
  const sign = direction === "long" ? 1 : -1;
  return { stop, target: entry + sign * targetDistance };
}

export function sizingMethodOf(strategy: StrategyDefinition): SizingMethod {
  return strategy.positionSizing.method;
}

export function compatibleWithRegime(strategy: StrategyDefinition, regime: RegimeLabel): boolean {
  return strategy.compatibleRegimes.includes(regime) || strategy.compatibleRegimes.includes("any");
}

export function parseStrategy(input: unknown): StrategyDefinition {
  return StrategyDefinitionSchema.parse(input);
}

export type { AssetClass, StrategyLifecycle, RuleExpr };
