import { runDeterministicDesk } from "@/core/research-desk";
import { barsFor, getInstrument, getStrategy, listStrategies } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => {
    const strategies = listStrategies(user.userId);
    const strategy = strategies[0] ? getStrategy(user.userId, strategies[0].strategyId) : null;
    if (!strategy) return { report: null };
    const inst = getInstrument(strategy.instruments[0]);
    return { report: runDeterministicDesk(strategy, barsFor(inst.symbol, inst.assetClass)), strategy };
  });
}
