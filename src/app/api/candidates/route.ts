import { listCandidates, scanStrategy, listStrategies } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ candidates: listCandidates(user.userId) }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { strategyId?: string };
  return withUser((user) => {
    const strategyId = body.strategyId ?? listStrategies(user.userId)[0]?.strategyId;
    if (!strategyId) throw new Error("no strategy available");
    return { candidates: scanStrategy(user.userId, strategyId) };
  });
}
