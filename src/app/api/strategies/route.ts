import { createStrategyVersion, listStrategies } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ strategies: listStrategies(user.userId) }));
}

export async function POST(req: Request) {
  const body = await req.json();
  return withUser((user) => ({ strategy: createStrategyVersion(user.userId, body) }));
}
