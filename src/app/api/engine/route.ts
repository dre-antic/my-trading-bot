import { leanStatistics, selectTradingEngine, toLeanConfig } from "@/core/lean-engine";
import { listStrategies, runStrategyBacktest } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => {
    const engine = selectTradingEngine();
    const strategies = listStrategies(user.userId);
    return {
      engine: { id: engine.id, readiness: engine.readiness },
      leanConfigs: strategies.map(toLeanConfig),
    };
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { strategyId?: string };
  return withUser((user) => {
    const id = body.strategyId ?? listStrategies(user.userId)[0]?.strategyId;
    if (!id) throw new Error("no strategy");
    const suite = runStrategyBacktest(user.userId, id);
    return { engine: selectTradingEngine().id, leanStatistics: leanStatistics(suite.full) };
  });
}
