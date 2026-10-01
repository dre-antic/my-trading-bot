import { getDb } from "@/db/client";
import { classifyMistakePatterns } from "@/core/journal";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => {
    const entries = getDb()
      .prepare("SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC")
      .all(user.userId);
    return { entries, patterns: classifyMistakePatterns(entries as never) };
  });
}
