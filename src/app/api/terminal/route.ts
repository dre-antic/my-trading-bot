import { withUser } from "@/server/http";
import { terminalSnapshot } from "@/server/terminal";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "EURUSD";
  const timeframe = url.searchParams.get("timeframe") ?? "H1";
  return withUser((user) => terminalSnapshot(user.userId, symbol, timeframe));
}
