import { migrate } from "@/db/migrate";
import { seed } from "@/db/seed";
import { processNextJob } from "@/server/jobs";

async function main() {
  migrate();
  await seed();
  console.log("ATCC worker started");
  for (;;) {
    const worked = await processNextJob();
    if (!worked) await new Promise((r) => setTimeout(r, 1000));
  }
}

void main();
