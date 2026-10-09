/** Self-heal policy. Auto-repair is fail-closed: never live, never orders, never circuit-breaker reset. */

export const FORBIDDEN_SELF_HEAL = [
  "enable_live",
  "arm_live",
  "reset_circuit_breaker",
  "place_order",
  "clear_stop_new_trades",
  "enable_autonomous",
  "substitute_synthetic_live_data",
] as const;

export type ForbiddenHeal = (typeof FORBIDDEN_SELF_HEAL)[number];

export type HealSeverity = "info" | "repairable" | "needs_human";

export type HealCode =
  | "schema.missing"
  | "operator.missing"
  | "flags.missing"
  | "live_control.missing"
  | "account.missing"
  | "paper_state.corrupt"
  | "constitution.missing"
  | "instruments.missing"
  | "jobs.stuck"
  | "jobs.retry"
  | "jobs.exhausted"
  | "experts.orphan"
  | "live.arm_expired"
  | "live.fail_closed_drift"
  | "positions.desynced";

export interface HealFinding {
  code: HealCode;
  severity: HealSeverity;
  message: string;
  auto: boolean;
  entityId?: string;
}

export interface HealAction {
  code: HealCode;
  applied: boolean;
  detail: string;
}

export interface HealReport {
  checkedAt: string;
  findings: HealFinding[];
  actions: HealAction[];
  refused: string[];
  healthy: boolean;
}

export function isForbiddenHeal(code: string): boolean {
  return (FORBIDDEN_SELF_HEAL as readonly string[]).includes(code);
}

export function planHeal(findings: HealFinding[]): HealFinding[] {
  return findings.filter((f) => f.auto && f.severity === "repairable" && !isForbiddenHeal(f.code));
}

export function assertHealAllowed(code: string): void {
  if (isForbiddenHeal(code)) {
    throw new Error(`Self-heal refuses "${code}". That action stays human-gated.`);
  }
}

export function isRecoverableRuntimeError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("no such table") ||
    m.includes("no broker account") ||
    m.includes("trading constitution is missing") ||
    m.includes("unexpected token") ||
    m.includes("is not valid json") ||
    m.includes("paper_state") ||
    m.includes("strategy not found")
  );
}
