import { migrate } from "@/db/migrate";
import { seed } from "@/db/seed";
import { processNextJob } from "@/server/jobs";
import { getRedis } from "@/server/redis-queue";
import { runSelfHeal } from "@/server/self-heal";

async function main() {
  migrate();
  await seed();
  await runSelfHeal({ force: true });
  console.log("ATCC worker started");
  let loops = 0;
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
    loops += 1;
    if (loops % 30 === 0) {
      await runSelfHeal();
    }
    if (!worked && !redis) await new Promise((r) => setTimeout(r, 1000));
  }
}

void main();
