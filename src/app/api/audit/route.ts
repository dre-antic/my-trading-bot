import { getDb } from "@/db/client";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({
    events: getDb()
      .prepare("SELECT id, action, entity, entity_id, payload, created_at FROM audit_events WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 200")
      .all(user.userId),
  }));
}
