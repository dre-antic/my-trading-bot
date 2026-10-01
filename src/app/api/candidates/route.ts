import { listCandidates, scanStrategy, listStrategies } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ candidates: listCandidates(user.userId) }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { strategyId?: string };
  return withUser((user) => {
    if (body.strategyId) return { candidates: scanStrategy(user.userId, body.strategyId) };
    const strategies = listStrategies(user.userId);
    if (!strategies.length) throw new Error("no strategy available");
    const candidates = strategies.flatMap((s) => scanStrategy(user.userId, s.strategyId));
    return { candidates };
  });
}
