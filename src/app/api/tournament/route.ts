import { tournament } from "@/server/trading-service";
import { withUser } from "@/server/http";

export async function POST() {
  return withUser((user) => tournament(user.userId));
}
