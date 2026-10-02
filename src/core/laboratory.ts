import type { StrategyLifecycle } from "./types";

export interface ChampionChallenger {
  experimentId: string;
  championStrategyId: string;
  challengerStrategyId: string;
  championVersion: number;
  challengerVersion: number;
  status: "RESEARCH" | "GATED" | "PROMOTED" | "REJECTED";
}

export interface ValidationEvidence {
  challengerLifecycle: StrategyLifecycle;
  outOfSampleTrades: number;
  walkForwardWindows: number;
  maxDrawdownPct: number;
  userApproved: boolean;
}

export interface GateResult {
  passed: boolean;
  failures: string[];
  note: string;
}

export const DEFAULT_GATES = {
  minOutOfSampleTrades: 10,
  minWalkForwardWindows: 2,
  maxDrawdownPct: 25,
};

const LIFECYCLES_READY: StrategyLifecycle[] = ["OUT_OF_SAMPLE", "WALK_FORWARD", "PAPER", "APPROVED"];

export function evaluateRobustnessGates(
  evidence: Pick<ValidationEvidence, "challengerLifecycle" | "outOfSampleTrades" | "walkForwardWindows" | "maxDrawdownPct">,
  gates = DEFAULT_GATES,
): GateResult {
  const failures: string[] = [];
  if (!LIFECYCLES_READY.includes(evidence.challengerLifecycle)) {
    failures.push(`Challenger lifecycle is ${evidence.challengerLifecycle}; it must reach OUT_OF_SAMPLE or later.`);
  }
  if (evidence.outOfSampleTrades < gates.minOutOfSampleTrades) {
    failures.push(`Out-of-sample trades ${evidence.outOfSampleTrades} < ${gates.minOutOfSampleTrades}.`);
  }
  if (evidence.walkForwardWindows < gates.minWalkForwardWindows) {
    failures.push(`Walk-forward windows ${evidence.walkForwardWindows} < ${gates.minWalkForwardWindows}.`);
  }
  if (evidence.maxDrawdownPct > gates.maxDrawdownPct) {
    failures.push(`Max drawdown ${evidence.maxDrawdownPct}% exceeds ${gates.maxDrawdownPct}%.`);
  }
  return {
    passed: failures.length === 0,
    failures,
    note: "Gates measure robustness evidence. Passing is not a profitability claim and never silently replaces a live strategy.",
  };
}

export function evaluatePromotionGates(evidence: ValidationEvidence, gates = DEFAULT_GATES): GateResult {
  const robustness = evaluateRobustnessGates(evidence, gates);
  const failures = [...robustness.failures];
  if (!evidence.userApproved) {
    failures.push("User has not approved replacement. Automatic live replacement is forbidden.");
  }
  return {
    passed: failures.length === 0,
    failures,
    note: robustness.note,
  };
}

/** Laboratory promotion never enables LIVE. Best-option alternative: APPROVED only. */
export function canPromoteToLive(_championLifecycle?: StrategyLifecycle, _gate?: GateResult): boolean {
  return false;
}
