import { closePosition } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function POST(req: Request) {
  const body = (await req.json()) as { instrument: string };
  return withUser((user) => {
    closePosition(user.userId, body.instrument);
    return { ok: true };
  });
}
