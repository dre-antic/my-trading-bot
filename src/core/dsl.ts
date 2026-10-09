import { z } from "zod";
import { crossedAbove, crossedBelow, lastDefined } from "./indicators";
import type { IndicatorSet } from "./strategy-context";

export const ComparatorSchema = z.enum([">", ">=", "<", "<=", "==", "!="]);
export type Comparator = z.infer<typeof ComparatorSchema>;

export const IndicatorNameSchema = z.enum([
  "close",
  "open",
  "high",
  "low",
  "volume",
  "sma",
  "ema",
  "rsi",
  "macd",
  "macd_signal",
  "macd_hist",
  "atr",
  "bb_mid",
  "bb_upper",
  "bb_lower",
  "vwap",
  "adx",
  "stoch_k",
  "stoch_d",
  "support",
  "resistance",
]);
export type IndicatorName = z.infer<typeof IndicatorNameSchema>;

export const ValueRefSchema = z.object({
  kind: z.enum(["indicator", "literal", "account"]),
  name: z.string().optional(),
  period: z.number().int().positive().optional(),
  value: z.string().optional(),
  accountField: z.enum(["cash", "equity", "position_qty"]).optional(),
});
export type ValueRef = z.infer<typeof ValueRefSchema>;

export type RuleExpr =
  | { op: "and"; args: RuleExpr[] }
  | { op: "or"; args: RuleExpr[] }
  | { op: "not"; arg: RuleExpr }
  | { op: "cmp"; left: ValueRef; cmp: Comparator; right: ValueRef }
  | { op: "crosses_above"; left: ValueRef; right: ValueRef }
  | { op: "crosses_below"; left: ValueRef; right: ValueRef };

export const RuleExprSchema: z.ZodType<RuleExpr> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("and"), args: z.array(RuleExprSchema) }),
    z.object({ op: z.literal("or"), args: z.array(RuleExprSchema) }),
    z.object({ op: z.literal("not"), arg: RuleExprSchema }),
    z.object({ op: z.literal("cmp"), left: ValueRefSchema, cmp: ComparatorSchema, right: ValueRefSchema }),
    z.object({ op: z.literal("crosses_above"), left: ValueRefSchema, right: ValueRefSchema }),
    z.object({ op: z.literal("crosses_below"), left: ValueRefSchema, right: ValueRefSchema }),
  ]),
);

export interface RuleEvaluation {
  passed: boolean;
  reason: string;
  missing: boolean;
}

export function evaluateRule(expr: RuleExpr, ctx: IndicatorSet): RuleEvaluation {
  switch (expr.op) {
    case "and": {
      const parts = expr.args.map((a) => evaluateRule(a, ctx));
      const missing = parts.some((p) => p.missing);
      const passed = parts.every((p) => p.passed);
      return {
        passed,
        missing,
        reason: parts.map((p) => p.reason).join(" AND "),
      };
    }
    case "or": {
      const parts = expr.args.map((a) => evaluateRule(a, ctx));
      const missing = parts.every((p) => p.missing);
      const passed = parts.some((p) => p.passed);
      return {
        passed,
        missing,
        reason: parts.map((p) => p.reason).join(" OR "),
      };
    }
    case "not": {
      const inner = evaluateRule(expr.arg, ctx);
      return { passed: !inner.passed && !inner.missing, missing: inner.missing, reason: `NOT (${inner.reason})` };
    }
    case "cmp": {
      const left = resolveScalar(expr.left, ctx);
      const right = resolveScalar(expr.right, ctx);
      if (left == null || right == null) {
        return { passed: false, missing: true, reason: `${label(expr.left)} ${expr.cmp} ${label(expr.right)} (insufficient data)` };
      }
      const passed = compare(left, expr.cmp, right);
      return {
        passed,
        missing: false,
        reason: `${label(expr.left)}=${left.toFixed(4)} ${expr.cmp} ${label(expr.right)}=${right.toFixed(4)}`,
      };
    }
    case "crosses_above": {
      const left = resolveSeries(expr.left, ctx);
      const right = resolveSeries(expr.right, ctx);
      if (!left || !right) {
        return { passed: false, missing: true, reason: `${label(expr.left)} crosses above ${label(expr.right)} (insufficient data)` };
      }
      const passed = crossedAbove(left, right);
      return { passed, missing: false, reason: `${label(expr.left)} crosses above ${label(expr.right)} = ${passed}` };
    }
    case "crosses_below": {
      const left = resolveSeries(expr.left, ctx);
      const right = resolveSeries(expr.right, ctx);
      if (!left || !right) {
        return { passed: false, missing: true, reason: `${label(expr.left)} crosses below ${label(expr.right)} (insufficient data)` };
      }
      const passed = crossedBelow(left, right);
      return { passed, missing: false, reason: `${label(expr.left)} crosses below ${label(expr.right)} = ${passed}` };
    }
    default:
      return { passed: false, missing: true, reason: "unknown expression" };
  }
}

function compare(left: number, cmp: Comparator, right: number): boolean {
  switch (cmp) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function resolveScalar(ref: ValueRef, ctx: IndicatorSet): number | null {
  if (ref.kind === "literal") return ref.value == null ? null : Number(ref.value);
  if (ref.kind === "account") {
    if (ref.accountField === "cash") return ctx.account.cash;
    if (ref.accountField === "equity") return ctx.account.equity;
    if (ref.accountField === "position_qty") return ctx.account.positionQty;
    return null;
  }
  const series = resolveSeries(ref, ctx);
  return series ? lastDefined(series) : null;
}

function resolveSeries(ref: ValueRef, ctx: IndicatorSet): Array<number | null> | null {
  if (ref.kind !== "indicator" || !ref.name) return null;
  const key = seriesKey(ref.name, ref.period);
  return ctx.series[key] ?? ctx.series[ref.name] ?? null;
}

export function seriesKey(name: string, period?: number): string {
  return period ? `${name}_${period}` : name;
}

function label(ref: ValueRef): string {
  if (ref.kind === "literal") return ref.value ?? "null";
  if (ref.kind === "account") return ref.accountField ?? "account";
  return ref.period ? `${ref.name}(${ref.period})` : ref.name ?? "indicator";
}

export function explainRuleTree(expr: RuleExpr, ctx: IndicatorSet): Array<{ rule: string; passed: boolean; missing: boolean }> {
  const evaled = evaluateRule(expr, ctx);
  const rows = [{ rule: evaled.reason, passed: evaled.passed, missing: evaled.missing }];
  if (expr.op === "and" || expr.op === "or") {
    for (const arg of expr.args) rows.push(...explainRuleTree(arg, ctx));
  }
  if (expr.op === "not") rows.push(...explainRuleTree(expr.arg, ctx));
  return rows;
}
