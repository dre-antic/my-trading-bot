import { z } from "zod";
import type { AssetClass, CandidateStatus, Direction } from "./types";

export const TradeCandidateSchema = z.object({
  candidateId: z.string(),
  strategyId: z.string(),
  strategyVersion: z.number().int().positive(),
  instrument: z.string(),
  assetClass: z.enum(["equity", "etf", "forex", "crypto", "future", "option", "other"]),
  direction: z.enum(["long", "short"]),
  timeframe: z.string(),
  entry: z.string(),
  stop: z.string(),
  target: z.string(),
  positionSize: z.string(),
  riskAmount: z.string(),
  rewardAmount: z.string(),
  riskReward: z.string(),
  strategyMatch: z.object({
    matched: z.boolean(),
    ambiguous: z.boolean(),
    satisfied: z.array(z.object({ rule: z.string(), passed: z.boolean() })),
    failed: z.array(z.object({ rule: z.string(), passed: z.boolean() })),
    clarifications: z.array(z.string()),
  }),
  technicalEvidence: z.array(z.string()),
  fundamentalEvidence: z.array(z.string()),
  newsEvidence: z.array(z.string()),
  marketRegime: z.object({
    primary: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string()),
  }),
  bullCase: z.string(),
  bearCase: z.string(),
  riskAnalysis: z.string(),
  executionAnalysis: z.string(),
  invalidationConditions: z.array(z.string()),
  dataTimestamp: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  status: z.enum([
    "DISCOVERED",
    "RESEARCHING",
    "QUALIFIED",
    "RISK_REJECTED",
    "WAITING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "EXECUTED",
    "CANCELLED",
  ]),
  userId: z.string(),
  accountId: z.string(),
  broker: z.string(),
  environment: z.enum(["paper", "live"]),
  resultKind: z.enum(["historical", "backtest", "paper", "live"]),
});

export type TradeCandidate = z.infer<typeof TradeCandidateSchema>;

export const CANDIDATE_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  DISCOVERED: ["RESEARCHING", "QUALIFIED", "RISK_REJECTED", "CANCELLED", "EXPIRED"],
  RESEARCHING: ["QUALIFIED", "REJECTED", "RISK_REJECTED", "CANCELLED", "EXPIRED"],
  QUALIFIED: ["WAITING_APPROVAL", "RISK_REJECTED", "CANCELLED", "EXPIRED"],
  RISK_REJECTED: ["CANCELLED"],
  WAITING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"],
  APPROVED: ["EXECUTED", "CANCELLED", "EXPIRED"],
  REJECTED: [],
  EXPIRED: [],
  EXECUTED: [],
  CANCELLED: [],
};

export function transitionCandidate(from: CandidateStatus, to: CandidateStatus): boolean {
  return CANDIDATE_TRANSITIONS[from].includes(to);
}

export function riskReward(entry: string, stop: string, target: string, direction: Direction): string {
  const e = Number(entry);
  const s = Number(stop);
  const t = Number(target);
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk === 0) return "0";
  if (direction === "long" && (s >= e || t <= e)) return "0";
  if (direction === "short" && (s <= e || t >= e)) return "0";
  return (reward / risk).toFixed(2);
}

export type { AssetClass, CandidateStatus };
