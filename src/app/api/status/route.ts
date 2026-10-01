import { health } from "@/server/trading-service";
import { getDb } from "@/db/client";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser(() => ({
    health: health(),
    jobs: getDb().prepare("SELECT status, COUNT(*) as c FROM jobs GROUP BY status").all(),
    recentSystem: getDb().prepare("SELECT * FROM system_events ORDER BY created_at DESC LIMIT 10").all(),
  }));
}
