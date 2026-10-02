import { migrate } from "@/db/migrate";
import { seed } from "@/db/seed";
import { processNextJob } from "@/server/jobs";
import { getRedis } from "@/server/redis-queue";

async function main() {
  migrate();
  await seed();
  console.log("ATCC worker started");
  for (;;) {
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.brpop("atcc:jobs", 1);
      } catch {
        // Redis is a wake-up only. Durable work stays in the SQL job table.
      }
    }
    const worked = await processNextJob();
    if (!worked && !redis) await new Promise((r) => setTimeout(r, 1000));
  }
}

void main();
