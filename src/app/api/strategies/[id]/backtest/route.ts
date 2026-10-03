import { runStrategyBacktest } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser((user) => runStrategyBacktest(user.userId, id));
}
