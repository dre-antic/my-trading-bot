import { health } from "@/server/trading-service";
import { getDb } from "@/db/client";
import { withUser } from "@/server/http";
import { notificationStatus } from "@/server/notifications";
import { redisHealth } from "@/server/redis-queue";
import { selectTradingEngine } from "@/core/lean-engine";

export async function GET() {
  return withUser(async () => {
    const engine = selectTradingEngine();
    return {
      health: health(),
      redis: await redisHealth(),
      notifications: notificationStatus(),
      engine: { id: engine.id, readiness: engine.readiness },
      jobs: getDb().prepare("SELECT status, COUNT(*) as c FROM jobs GROUP BY status").all(),
      marketDataSources: getDb().prepare("SELECT provider, readiness, notes FROM market_data_sources").all(),
      recentSystem: getDb().prepare("SELECT * FROM system_events ORDER BY created_at DESC LIMIT 10").all(),
    };
  });
}
