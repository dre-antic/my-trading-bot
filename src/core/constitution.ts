import { z } from "zod";
import { Money, Qty } from "./money";
import type { AssetClass } from "./types";

export const ConstitutionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  authorizedByUserId: z.string(),
  maxRiskPerTradePct: z.string(),
  maxRiskPerTradeAmount: z.string(),
  maxDailyLossPct: z.string(),
  maxWeeklyLossPct: z.string(),
  maxDrawdownPct: z.string(),
  maxLeverage: z.string(),
  maxPortfolioExposurePct: z.string(),
  maxInstrumentExposurePct: z.string(),
  maxCorrelatedExposurePct: z.string(),
  maxSimultaneousPositions: z.number().int().positive(),
  maxOrderNotional: z.string(),
  minLiquidityNotional: z.string(),
  maxSpreadBps: z.string(),
  maxSlippageBps: z.string(),
  permittedTradingHours: z.string(),
  permittedMarkets: z.array(z.string()),
  permittedAssetClasses: z.array(z.string()),
  permittedStrategies: z.array(z.string()),
  permittedBrokers: z.array(z.string()),
  requireStopLoss: z.boolean(),
  maxDataAgeSeconds: z.number().int().positive(),
  maxSignalAgeSeconds: z.number().int().positive(),
  emergencyHalt: z.boolean(),
  notes: z.string(),
});

export type Constitution = z.infer<typeof ConstitutionSchema>;

export const DEFAULT_CONSTITUTION_LIMITS: Omit<
  Constitution,
  "id" | "version" | "createdAt" | "authorizedByUserId"
> = {
  maxRiskPerTradePct: "0.5",
  maxRiskPerTradeAmount: "500",
  maxDailyLossPct: "2",
  maxWeeklyLossPct: "5",
  maxDrawdownPct: "15",
  maxLeverage: "1",
  maxPortfolioExposurePct: "80",
  maxInstrumentExposurePct: "40",
  maxCorrelatedExposurePct: "50",
  maxSimultaneousPositions: 8,
  maxOrderNotional: "50000",
  minLiquidityNotional: "0",
  maxSpreadBps: "30",
  maxSlippageBps: "20",
  permittedTradingHours: "always",
  permittedMarkets: ["*"],
  permittedAssetClasses: ["equity", "etf", "forex", "crypto"],
  permittedStrategies: ["*"],
  permittedBrokers: ["paper", "alpaca_paper", "alpaca_live", "oanda_practice", "oanda_live"],
  requireStopLoss: true,
  maxDataAgeSeconds: 300,
  maxSignalAgeSeconds: 600,
  emergencyHalt: false,
  notes: "Default conservative constitution. AI agents cannot change this document.",
};

export function parseConstitution(input: unknown): Constitution {
  return ConstitutionSchema.parse(input);
}

export function constitutionAllowsAssetClass(constitution: Constitution, assetClass: AssetClass): boolean {
  return constitution.permittedAssetClasses.includes(assetClass) || constitution.permittedAssetClasses.includes("*");
}

export function constitutionAllowsBroker(constitution: Constitution, broker: string): boolean {
  return constitution.permittedBrokers.includes(broker) || constitution.permittedBrokers.includes("*");
}

export function constitutionAllowsStrategy(constitution: Constitution, strategyId: string): boolean {
  return constitution.permittedStrategies.includes(strategyId) || constitution.permittedStrategies.includes("*");
}

export function constitutionAllowsMarket(constitution: Constitution, market: string): boolean {
  return constitution.permittedMarkets.includes(market) || constitution.permittedMarkets.includes("*");
}

export function pctOf(equity: Money, pct: string): Money {
  return equity.mul(new Qty(pct).div(100));
}

export function nextConstitutionVersion(
  previous: Constitution,
  patch: Partial<Omit<Constitution, "id" | "version" | "createdAt" | "authorizedByUserId">>,
  authorizedByUserId: string,
  createdAt: string,
  newId: string,
): Constitution {
  return parseConstitution({
    ...previous,
    ...patch,
    id: newId,
    version: previous.version + 1,
    createdAt,
    authorizedByUserId,
  });
}
