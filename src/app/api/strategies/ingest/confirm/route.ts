import { withUser } from "@/server/http";
import { confirmIngest } from "@/server/strategy-ingest";

export async function POST(req: Request) {
  const body = (await req.json()) as { documentId?: string; attach?: boolean; symbol?: string };
  return withUser((user) => {
    if (!body.documentId) throw new Error("documentId is required");
    return confirmIngest(user.userId, body.documentId, { attach: body.attach, symbol: body.symbol });
  });
}
