import { analyzePortfolio } from "@/core/portfolio";
import { health, listCandidates, listStrategies, portfolioOf, flags, latestConstitution } from "@/server/trading-service";
import { getDb } from "@/db/client";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => {
    const port = portfolioOf(user.userId);
    const db = getDb();
    const openOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status IN ('submitted','accepted','partially_filled')").get(user.userId) as { c: number };
    return {
      portfolio: port,
      intelligence: analyzePortfolio(port),
      flags: flags(user.userId),
      constitution: latestConstitution(user.userId),
      candidates: listCandidates(user.userId).slice(0, 5),
      strategies: listStrategies(user.userId),
      openOrders: openOrders.c,
      health: health(),
    };
  });
}
