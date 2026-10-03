import { promoteExperiment } from "@/server/laboratory";
import { withUser } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { confirmPhrase: string };
  return withUser((user) => promoteExperiment(user.userId, id, body.confirmPhrase));
}
