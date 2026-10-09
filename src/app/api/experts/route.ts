import { withUser } from "@/server/http";
import { attachExpertToChart, runAttachedExperts, toggleExpert } from "@/server/terminal";
import { listExperts } from "@/server/ticket";

export async function GET() {
  return withUser((user) => ({ experts: listExperts(user.userId) }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "attach" | "toggle" | "run";
    strategyId?: string;
    symbol?: string;
    id?: string;
    enabled?: boolean;
  };
  return withUser((user) => {
    if (body.action === "attach") {
      if (!body.strategyId || !body.symbol) throw new Error("strategyId and symbol are required.");
      return attachExpertToChart(user.userId, body.strategyId, body.symbol);
    }
    if (body.action === "toggle") {
      if (!body.id) throw new Error("id is required.");
      toggleExpert(user.userId, body.id, Boolean(body.enabled));
      return { ok: true };
    }
    if (body.action === "run") {
      return { candidates: runAttachedExperts(user.userId, body.symbol) };
    }
    throw new Error("Unknown expert action.");
  });
}
