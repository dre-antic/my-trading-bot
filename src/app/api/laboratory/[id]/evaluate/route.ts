import { evaluateExperiment } from "@/server/laboratory";
import { withUser } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { userApproved?: boolean };
  return withUser((user) => evaluateExperiment(user.userId, id, Boolean(body.userApproved)));
}
