import { getDb } from "@/db/client";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({
    alerts: getDb().prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(user.userId),
  }));
}
