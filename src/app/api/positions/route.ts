import { portfolioOf } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ portfolio: portfolioOf(user.userId) }));
}
