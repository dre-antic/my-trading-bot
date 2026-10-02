import { flags, latestConstitution, portfolioOf } from "@/server/trading-service";
import { liveStatus } from "@/server/live-control";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({
    ...user,
    flags: flags(user.userId),
    constitutionVersion: latestConstitution(user.userId).version,
    portfolio: portfolioOf(user.userId),
    live: liveStatus(user.userId),
  }));
}
