import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { importDocument, runStrategyBacktest, scanStrategy } from "./trading-service";

export type JobKind = "market_scan" | "backtest" | "document" | "walk_forward" | "monte_carlo" | "ai_research";

export function enqueueJob(userId: string, kind: JobKind, payload: unknown): string {
  const id = ids.job();
  getDb()
    .prepare(
      "INSERT INTO jobs (id, user_id, kind, status, progress, logs, payload, created_at, attempts) VALUES (?, ?, ?, 'queued', 0, '', ?, ?, 0)",
    )
    .run(id, userId, kind, JSON.stringify(payload), toIsoUtc());
  return id;
}

export function listJobs(userId: string) {
  return getDb()
    .prepare("SELECT id, kind, status, progress, error, created_at, completed_at FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(userId);
}

export async function processNextJob(): Promise<boolean> {
  const row = getDb().prepare("SELECT * FROM jobs WHERE status IN ('queued', 'retry') ORDER BY created_at LIMIT 1").get() as
    | {
        id: string;
        user_id: string;
        kind: JobKind;
        payload: string;
        attempts: number;
      }
    | undefined;
  if (!row) return false;
  getDb()
    .prepare("UPDATE jobs SET status = 'running', started_at = ?, attempts = attempts + 1 WHERE id = ?")
    .run(toIsoUtc(), row.id);
  try {
    const payload = JSON.parse(row.payload) as Record<string, string>;
    let result: unknown = {};
    if (row.kind === "market_scan") result = scanStrategy(row.user_id, payload.strategyId);
    else if (row.kind === "backtest" || row.kind === "walk_forward" || row.kind === "monte_carlo") {
      result = runStrategyBacktest(row.user_id, payload.strategyId);
    } else if (row.kind === "document") {
      result = importDocument(row.user_id, payload.filename, payload.text);
    } else {
      result = { note: "AI research jobs require a configured provider. Deterministic desk was used instead." };
    }
    getDb()
      .prepare("UPDATE jobs SET status = 'completed', progress = 100, result = ?, completed_at = ? WHERE id = ?")
      .run(JSON.stringify(result), toIsoUtc(), row.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "job failed";
    const retry = row.attempts < 2;
    getDb()
      .prepare("UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?")
      .run(retry ? "retry" : "failed", message, toIsoUtc(), row.id);
  }
  return true;
}
