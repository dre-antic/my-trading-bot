import { latestConstitution } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function GET() {
  return withUser((user) => ({ constitution: latestConstitution(user.userId) }));
}
