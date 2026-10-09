import { decideCandidate } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { decision: "APPROVE" | "REJECT" | "WATCH"; quantity?: string };
  return withUser((user) => decideCandidate(user.userId, id, body.decision, body.quantity));
}
