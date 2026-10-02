import { createExperiment, laboratoryOverview } from "@/server/laboratory";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => laboratoryOverview(user.userId));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { championStrategyId: string; challengerStrategyId: string };
  return withUser((user) => createExperiment(user.userId, body.championStrategyId, body.challengerStrategyId));
}
