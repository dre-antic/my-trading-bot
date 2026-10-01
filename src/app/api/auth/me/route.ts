import { flags, latestConstitution, portfolioOf } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({
    ...user,
    flags: flags(user.userId),
    constitutionVersion: latestConstitution(user.userId).version,
    portfolio: portfolioOf(user.userId),
  }));
}
