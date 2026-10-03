import { getCandidate, riskCheckCandidate } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withUser((user) => {
    const checked = riskCheckCandidate(user.userId, id);
    return { candidate: getCandidate(user.userId, id), risk: checked.risk, sizing: checked.sizing };
  });
}
