import { getDb } from "@/db/client";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({
    orders: getDb()
      .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY submitted_at DESC")
      .all(user.userId),
    fills: getDb()
      .prepare(
        "SELECT f.* FROM fills f JOIN orders o ON o.id = f.order_id WHERE o.user_id = ? ORDER BY f.filled_at DESC",
      )
      .all(user.userId),
  }));
}
