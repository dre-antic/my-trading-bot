import {
  LIVE_PHRASES,
  assertDistinctLiveKeys,
  assertLiveBrokerUrl,
  assertPhrase,
  evaluateArmLive,
  evaluateEnableLive,
  evaluatePlaceLiveOrder,
  nextArmedUntil,
  shouldTripBreaker,
  type LiveGateInput,
} from "@/core/live-safety";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { loadConfig } from "./config";
import { audit } from "./audit";

export interface LiveControl {
  liveEnabled: boolean;
  armedUntil: string | null;
  halted: boolean;
  haltReason: string | null;
  brokerErrorStreak: number;
}

function ensureRow(userId: string): void {
  const exists = getDb().prepare("SELECT user_id FROM live_control WHERE user_id = ?").get(userId);
  if (!exists) {
    getDb()
      .prepare(
        "INSERT INTO live_control (user_id, live_enabled, armed_until, halted, halt_reason, broker_error_streak, updated_at) VALUES (?, 0, NULL, 0, NULL, 0, ?)",
      )
      .run(userId, toIsoUtc());
  }
}

export function getLiveControl(userId: string): LiveControl {
  ensureRow(userId);
  const row = getDb().prepare("SELECT * FROM live_control WHERE user_id = ?").get(userId) as {
    live_enabled: number;
    armed_until: string | null;
    halted: number;
    halt_reason: string | null;
    broker_error_streak: number;
  };
  return {
    liveEnabled: row.live_enabled === 1,
    armedUntil: row.armed_until,
    halted: row.halted === 1,
    haltReason: row.halt_reason,
    brokerErrorStreak: row.broker_error_streak,
  };
}

function runtimeFlags(userId: string): {
  display_mode: "demo" | "paper" | "live";
  trading_mode: "research" | "assisted" | "autonomous";
  live_enabled: number;
  stop_new_trades: number;
} {
  return getDb().prepare("SELECT display_mode, trading_mode, live_enabled, stop_new_trades FROM runtime_flags WHERE user_id = ?").get(userId) as {
    display_mode: "demo" | "paper" | "live";
    trading_mode: "research" | "assisted" | "autonomous";
    live_enabled: number;
    stop_new_trades: number;
  };
}

function gateInput(userId: string, phrase?: string): LiveGateInput {
  const cfg = loadConfig();
  const runtime = runtimeFlags(userId);
  const live = getLiveControl(userId);
  return {
    envLiveEnabled: cfg.liveEnabled,
    userLiveEnabled: live.liveEnabled || runtime.live_enabled === 1,
    armedUntil: live.armedUntil,
    halted: live.halted,
    haltReason: live.haltReason,
    stopNewTrades: runtime.stop_new_trades === 1,
    displayMode: runtime.display_mode,
    tradingMode: runtime.trading_mode,
    sessionSecret: cfg.sessionSecret,
    now: new Date(),
    confirmPhrase: phrase,
    paperKey: cfg.alpacaPaperKey,
    liveKey: cfg.alpacaLiveKey,
    liveBaseUrl: cfg.alpacaLiveBaseUrl,
  };
}

export function enableLiveTrading(userId: string, confirmPhrase: string): LiveControl {
  const result = evaluateEnableLive({
    envLiveEnabled: loadConfig().liveEnabled,
    sessionSecret: loadConfig().sessionSecret,
    confirmPhrase,
  });
  if (!result.ok) throw new Error(result.failures.join(" "));
  ensureRow(userId);
  getDb().prepare("UPDATE live_control SET live_enabled = 1, updated_at = ? WHERE user_id = ?").run(toIsoUtc(), userId);
  getDb().prepare("UPDATE runtime_flags SET live_enabled = 1, display_mode = 'live' WHERE user_id = ?").run(userId);
  audit({ userId, action: "live.enabled", entity: "runtime" });
  return getLiveControl(userId);
}

export function disableLiveTrading(userId: string, confirmPhrase: string): LiveControl {
  assertPhrase(confirmPhrase, LIVE_PHRASES.disable);
  ensureRow(userId);
  getDb()
    .prepare("UPDATE live_control SET live_enabled = 0, armed_until = NULL, updated_at = ? WHERE user_id = ?")
    .run(toIsoUtc(), userId);
  getDb().prepare("UPDATE runtime_flags SET live_enabled = 0, display_mode = 'paper' WHERE user_id = ?").run(userId);
  audit({ userId, action: "live.disabled", entity: "runtime" });
  return getLiveControl(userId);
}

export function armLiveSession(userId: string, confirmPhrase: string): LiveControl {
  const result = evaluateArmLive(gateInput(userId, confirmPhrase));
  if (!result.ok) throw new Error(result.failures.join(" "));
  const until = nextArmedUntil(new Date());
  getDb().prepare("UPDATE live_control SET armed_until = ?, updated_at = ? WHERE user_id = ?").run(until, toIsoUtc(), userId);
  audit({ userId, action: "live.armed", entity: "runtime", payload: { until } });
  return getLiveControl(userId);
}

export function disarmLiveSession(userId: string, confirmPhrase = LIVE_PHRASES.disarm): LiveControl {
  assertPhrase(confirmPhrase, LIVE_PHRASES.disarm);
  ensureRow(userId);
  getDb().prepare("UPDATE live_control SET armed_until = NULL, updated_at = ? WHERE user_id = ?").run(toIsoUtc(), userId);
  audit({ userId, action: "live.disarmed", entity: "runtime" });
  return getLiveControl(userId);
}

export function resetCircuitBreaker(userId: string, confirmPhrase: string): LiveControl {
  assertPhrase(confirmPhrase, LIVE_PHRASES.resetBreaker);
  ensureRow(userId);
  getDb()
    .prepare("UPDATE live_control SET halted = 0, halt_reason = NULL, broker_error_streak = 0, updated_at = ? WHERE user_id = ?")
    .run(toIsoUtc(), userId);
  audit({ userId, action: "live.breaker_reset", entity: "runtime" });
  return getLiveControl(userId);
}

export function assertCanPlaceLiveOrder(userId: string, confirmPhrase: string): void {
  const input = gateInput(userId, confirmPhrase);
  const result = evaluatePlaceLiveOrder(input);
  if (!result.ok) throw new Error(result.failures.join(" "));
  if (input.liveBaseUrl) assertLiveBrokerUrl(input.liveBaseUrl);
  if (input.liveKey) assertDistinctLiveKeys(input.paperKey, input.liveKey);
}

export function recordBrokerError(userId: string, message: string): void {
  ensureRow(userId);
  const live = getLiveControl(userId);
  const streak = live.brokerErrorStreak + 1;
  const halt = shouldTripBreaker(streak);
  getDb()
    .prepare("UPDATE live_control SET broker_error_streak = ?, halted = ?, halt_reason = ?, armed_until = ?, updated_at = ? WHERE user_id = ?")
    .run(streak, halt ? 1 : 0, halt ? message : live.haltReason, halt ? null : live.armedUntil, toIsoUtc(), userId);
  if (halt) audit({ userId, action: "live.circuit_breaker", entity: "runtime", payload: { message, streak } });
}

export function recordBrokerSuccess(userId: string): void {
  getDb().prepare("UPDATE live_control SET broker_error_streak = 0, updated_at = ? WHERE user_id = ?").run(toIsoUtc(), userId);
}

export function liveStatus(userId: string) {
  return {
    envLiveEnabled: loadConfig().liveEnabled,
    control: getLiveControl(userId),
    phrases: LIVE_PHRASES,
    brokers: {
      alpacaLive: Boolean(loadConfig().alpacaLiveKey && loadConfig().alpacaLiveSecret),
      oanda: Boolean(loadConfig().oandaToken && loadConfig().oandaAccountId),
      oandaEnv: loadConfig().oandaEnv,
    },
  };
}
