/** Fail-closed live trading gates. AI cannot call these; phrases must match exactly. */

export const LIVE_PHRASES = {
  enable: "ENABLE LIVE TRADING",
  disable: "DISABLE LIVE TRADING",
  arm: "ARM LIVE SESSION",
  disarm: "DISARM LIVE",
  place: "PLACE LIVE ORDER",
  resetBreaker: "RESET CIRCUIT BREAKER",
} as const;

export const LIVE_ARM_MS = 15 * 60 * 1000;
export const MAX_BROKER_ERRORS = 3;

const DEFAULT_SECRETS = new Set([
  "dev-only-session-secret-change-me-32ch",
  "change-me-to-a-long-random-string-at-least-32-chars",
]);

export const LIVE_HOSTS = {
  alpacaLive: "https://api.alpaca.markets",
  alpacaPaper: "https://paper-api.alpaca.markets",
  oandaLive: "https://api-fxtrade.oanda.com",
  oandaPractice: "https://api-fxpractice.oanda.com",
} as const;

export interface LiveGateInput {
  envLiveEnabled: boolean;
  userLiveEnabled: boolean;
  armedUntil?: string | null;
  halted: boolean;
  haltReason?: string | null;
  stopNewTrades: boolean;
  displayMode: "demo" | "paper" | "live";
  tradingMode: "research" | "assisted" | "autonomous";
  sessionSecret: string;
  now: Date;
  confirmPhrase?: string;
  paperKey?: string;
  liveKey?: string;
  liveBaseUrl?: string;
}

export interface LiveGateResult {
  ok: boolean;
  failures: string[];
}

export function assertPhrase(actual: string | undefined, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Confirmation phrase must be exactly "${expected}".`);
  }
}

export function sessionSecretAllowsLive(secret: string): boolean {
  return Boolean(secret) && secret.length >= 32 && !DEFAULT_SECRETS.has(secret);
}

export function isPaperTradingHost(url: string): boolean {
  const host = url.toLowerCase();
  return host.includes("paper-api.alpaca.markets") || host.includes("api-fxpractice.oanda.com");
}

export function assertLiveBrokerUrl(url: string): void {
  if (isPaperTradingHost(url)) {
    throw new Error("Refusing to send a LIVE order to a paper/practice host.");
  }
  const ok = url.startsWith(LIVE_HOSTS.alpacaLive) || url.startsWith(LIVE_HOSTS.oandaLive);
  if (!ok) {
    throw new Error("Live broker URL is not on the allowlist (api.alpaca.markets or api-fxtrade.oanda.com).");
  }
}

export function assertDistinctLiveKeys(paperKey: string | undefined, liveKey: string | undefined): void {
  if (!liveKey) throw new Error("Live broker keys are not configured. Refusing to invent a live order.");
  if (paperKey && liveKey === paperKey) {
    throw new Error("Live keys must be distinct from paper keys.");
  }
}

export function evaluateEnableLive(input: Pick<LiveGateInput, "envLiveEnabled" | "sessionSecret" | "confirmPhrase">): LiveGateResult {
  const failures: string[] = [];
  if (input.confirmPhrase !== LIVE_PHRASES.enable) {
    failures.push(`Confirmation phrase must be exactly "${LIVE_PHRASES.enable}".`);
  }
  if (!input.envLiveEnabled) {
    failures.push("ATCC_LIVE_ENABLED is not true. Live trading stays blocked by environment policy.");
  }
  if (!sessionSecretAllowsLive(input.sessionSecret)) {
    failures.push("SESSION_SECRET is still the example/dev default. Change it before enabling live.");
  }
  return { ok: failures.length === 0, failures };
}

export function evaluateArmLive(input: LiveGateInput): LiveGateResult {
  const failures: string[] = [];
  if (input.confirmPhrase !== LIVE_PHRASES.arm) {
    failures.push(`Confirmation phrase must be exactly "${LIVE_PHRASES.arm}".`);
  }
  if (!input.envLiveEnabled) failures.push("Environment LIVE policy is off.");
  if (!input.userLiveEnabled) failures.push("In-app LIVE is not enabled.");
  if (input.halted) failures.push(`Circuit breaker is halted${input.haltReason ? `: ${input.haltReason}` : "."}`);
  if (input.stopNewTrades) failures.push("Stop-new-trades is active.");
  if (input.displayMode !== "live") failures.push("Display mode must be live before arming.");
  if (input.tradingMode === "research") failures.push("Research mode cannot arm live.");
  if (input.tradingMode === "autonomous") failures.push("Autonomous mode cannot arm live. Use assisted and a human ticket.");
  return { ok: failures.length === 0, failures };
}

export function evaluatePlaceLiveOrder(input: LiveGateInput): LiveGateResult {
  const failures: string[] = [];
  if (input.confirmPhrase !== LIVE_PHRASES.place) {
    failures.push(`Live orders require the exact phrase "${LIVE_PHRASES.place}". One-click live is disabled.`);
  }
  if (!input.envLiveEnabled || !input.userLiveEnabled) {
    failures.push("LIVE is not fully enabled (environment + in-app).");
  }
  if (input.displayMode !== "live") failures.push("Display mode is not live.");
  if (input.tradingMode === "research") failures.push("Research mode cannot place live orders.");
  if (input.tradingMode === "autonomous") {
    failures.push("Autonomous mode cannot place live orders. AI never has unrestricted live access.");
  }
  if (input.halted) failures.push(`Circuit breaker halted${input.haltReason ? `: ${input.haltReason}` : "."}`);
  if (input.stopNewTrades) failures.push("Stop-new-trades is active.");
  if (!input.armedUntil || new Date(input.armedUntil).getTime() <= input.now.getTime()) {
    failures.push("Live session is not armed or has expired. Arm with ARM LIVE SESSION (15 minutes).");
  }
  return { ok: failures.length === 0, failures };
}

export function nextArmedUntil(now: Date, ms = LIVE_ARM_MS): string {
  return new Date(now.getTime() + ms).toISOString();
}

export function shouldTripBreaker(streak: number): boolean {
  return streak >= MAX_BROKER_ERRORS;
}
