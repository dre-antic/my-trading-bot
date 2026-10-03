import { enqueueJob, listJobs, processNextJob, type JobKind } from "@/server/jobs";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ jobs: listJobs(user.userId) }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { kind: JobKind; payload?: Record<string, string> };
  return withUser(async (user) => {
    const id = enqueueJob(user.userId, body.kind, body.payload ?? {});
    await processNextJob();
    return { id };
  });
}
