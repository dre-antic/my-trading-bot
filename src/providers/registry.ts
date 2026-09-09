import { db, nowIso } from "../db/index.js";
import type { ErrorClass, ProviderHealth } from "../types/index.js";
import { config } from "../config/index.js";

export interface ProviderMeta {
  id: string;
  kind: string;
  free: boolean;
  configured: boolean;
  /** Higher is better except costScore (higher = more expensive). */
}

export function providerScore(h: Pick<ProviderHealth, "qualityScore" | "availabilityScore" | "freeQuotaScore" | "speedScore" | "costScore">): number {
  return h.qualityScore + h.availabilityScore + h.freeQuotaScore + h.speedScore - h.costScore;
}

export function getStats(id: string, kind: string): ProviderHealth {
  let row = db.prepare("SELECT * FROM provider_stats WHERE id = ?").get(id) as
    | {
        id: string;
        kind: string;
        quality_score: number;
        availability_score: number;
        free_quota_score: number;
        speed_score: number;
        cost_score: number;
        calls: number;
        failures: number;
        last_latency_ms: number | null;
        last_error: string | null;
      }
    | undefined;
  if (!row) {
    db.prepare(
      `INSERT INTO provider_stats (id, kind, quality_score, availability_score, free_quota_score, speed_score, cost_score, calls, failures, updated_at)
       VALUES (?, ?, 70, 80, 80, 70, 0, 0, 0, ?)`,
    ).run(id, kind, nowIso());
    row = db.prepare("SELECT * FROM provider_stats WHERE id = ?").get(id) as typeof row;
  }
  return {
    id,
    kind,
    configured: true,
    free: true,
    lastError: row!.last_error ?? undefined,
    lastLatencyMs: row!.last_latency_ms ?? undefined,
    qualityScore: row!.quality_score,
    availabilityScore: row!.availability_score,
    freeQuotaScore: row!.free_quota_score,
    speedScore: row!.speed_score,
    costScore: row!.cost_score,
    calls: row!.calls,
    failures: row!.failures,
  };
}

export function recordSuccess(id: string, kind: string, latencyMs: number, qualityHint?: number): void {
  const s = getStats(id, kind);
  const quality = qualityHint ?? s.qualityScore;
  const speed = Math.max(10, Math.min(100, 100 - latencyMs / 80));
  db.prepare(
    `UPDATE provider_stats SET
      calls = calls + 1,
      availability_score = MIN(100, availability_score + 1),
      speed_score = (speed_score * 0.8) + (? * 0.2),
      quality_score = (quality_score * 0.9) + (? * 0.1),
      last_latency_ms = ?,
      last_error = NULL,
      updated_at = ?
     WHERE id = ?`,
  ).run(speed, quality, latencyMs, nowIso(), id);
}

export function recordFailure(id: string, kind: string, errorClass: ErrorClass, message: string): void {
  getStats(id, kind);
  const quotaPenalty = errorClass === "QUOTA" ? 20 : 0;
  db.prepare(
    `UPDATE provider_stats SET
      calls = calls + 1,
      failures = failures + 1,
      availability_score = MAX(0, availability_score - 8),
      free_quota_score = MAX(0, free_quota_score - ?),
      last_error = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(quotaPenalty, message.slice(0, 300), nowIso(), id);
}

export interface Rankable {
  id: string;
  kind: string;
  free: boolean;
  configured: boolean;
  paid: boolean;
}

export function rankProviders<T extends Rankable>(items: T[]): T[] {
  return [...items]
    .filter((p) => p.configured)
    .filter((p) => (p.paid ? config.allowPaidProviders : true))
    .sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      return providerScore(getStats(b.id, b.kind)) - providerScore(getStats(a.id, a.kind));
    });
}

export async function withFailover<T>(
  providers: Rankable[],
  fn: (id: string) => Promise<T>,
  opts?: { maxAttempts?: number },
): Promise<{ result: T; providerId: string }> {
  const max = opts?.maxAttempts ?? providers.length;
  let lastErr: unknown;
  let attempts = 0;
  for (const p of rankProviders(providers)) {
    if (attempts >= max) break;
    attempts += 1;
    const started = Date.now();
    try {
      const result = await fn(p.id);
      recordSuccess(p.id, p.kind, Date.now() - started);
      return { result, providerId: p.id };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const cls =
        msg.includes("429") || msg.toLowerCase().includes("quota")
          ? "QUOTA"
          : msg.toLowerCase().includes("401")
            ? "AUTHENTICATION"
            : "PROVIDER_FAILURE";
      recordFailure(p.id, p.kind, cls, msg);
    }
  }
  throw lastErr ?? new Error("No providers available");
}
