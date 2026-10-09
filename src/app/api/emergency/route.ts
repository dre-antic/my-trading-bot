import { emergency } from "@/server/trading-service";
import { withUser } from "@/server/http";
import type { EmergencyAction } from "@/core/emergency";

export async function POST(req: Request) {
  const body = (await req.json()) as { action: EmergencyAction; confirmPhrase: string };
  return withUser((user) => emergency(user.userId, body.action, body.confirmPhrase));
}
