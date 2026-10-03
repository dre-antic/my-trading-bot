import { Qty } from "./money";

export type CostTier = "demo" | "free" | "low_cost" | "premium";

export interface CostLedgerEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string;
  task: string;
  agent: string;
  userId: string;
  at: string;
}

export interface CostLimits {
  dailyUsd: string;
  monthlyUsd: string;
  perAgentUsd: string;
  paidServicesEnabled: boolean;
}

export function canSpend(entries: CostLedgerEntry[], limits: CostLimits, agent: string, addUsd: string, now: Date): {
  allowed: boolean;
  reason?: string;
} {
  if (!limits.paidServicesEnabled && Number(addUsd) > 0) {
    return { allowed: false, reason: "Paid services are OFF unless configured." };
  }
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const daily = sum(entries.filter((e) => e.at.startsWith(day)));
  const monthly = sum(entries.filter((e) => e.at.startsWith(month)));
  const agentSpend = sum(entries.filter((e) => e.agent === agent && e.at.startsWith(day)));
  const add = new Qty(addUsd);
  if (daily.add(add).gt(limits.dailyUsd)) return { allowed: false, reason: "Daily AI cost limit reached." };
  if (monthly.add(add).gt(limits.monthlyUsd)) return { allowed: false, reason: "Monthly AI cost limit reached." };
  if (agentSpend.add(add).gt(limits.perAgentUsd)) return { allowed: false, reason: "Per-agent AI cost limit reached." };
  return { allowed: true };
}

function sum(entries: CostLedgerEntry[]): Qty {
  return entries.reduce((s, e) => s.add(e.estimatedCostUsd), new Qty(0));
}
