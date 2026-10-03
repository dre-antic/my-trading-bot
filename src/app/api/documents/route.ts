import { importDocument } from "@/server/trading-service";
import { withUser } from "@/server/http";
import { getDb } from "@/db/client";

export async function GET() {
  return withUser((user) => ({
    documents: getDb().prepare("SELECT id, filename, kind, created_at FROM strategy_documents WHERE user_id = ? ORDER BY created_at DESC").all(user.userId),
  }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { filename?: string; text?: string };
  return withUser((user) => {
    if (!body.text || !body.filename) throw new Error("filename and text required");
    return importDocument(user.userId, body.filename, body.text);
  });
}
