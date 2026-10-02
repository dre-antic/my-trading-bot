import { LIVE_PHRASES } from "@/core/live-safety";
import type { DisplayMode, LiveTradingMode } from "@/core/types";
import { withUser } from "@/server/http";
import {
  armLiveSession,
  disableLiveTrading,
  disarmLiveSession,
  enableLiveTrading,
  liveStatus,
  resetCircuitBreaker,
} from "@/server/live-control";
import { setModes } from "@/server/trading-service";

export async function GET() {
  return withUser((user) => liveStatus(user.userId));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "enable" | "disable" | "arm" | "disarm" | "reset_breaker" | "set_modes";
    confirmPhrase?: string;
    displayMode?: DisplayMode;
    tradingMode?: LiveTradingMode;
  };
  return withUser((user) => {
    switch (body.action) {
      case "enable":
        return enableLiveTrading(user.userId, body.confirmPhrase ?? "");
      case "disable":
        return disableLiveTrading(user.userId, body.confirmPhrase ?? LIVE_PHRASES.disable);
      case "arm":
        return armLiveSession(user.userId, body.confirmPhrase ?? "");
      case "disarm":
        return disarmLiveSession(user.userId, body.confirmPhrase ?? LIVE_PHRASES.disarm);
      case "reset_breaker":
        return resetCircuitBreaker(user.userId, body.confirmPhrase ?? "");
      case "set_modes":
        setModes(user.userId, { displayMode: body.displayMode, tradingMode: body.tradingMode });
        return liveStatus(user.userId);
      default:
        throw new Error("Unknown live control action.");
    }
  });
}
