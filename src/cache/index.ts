import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, nowIso } from "../db/index.js";
import { config } from "../config/index.js";

export function cacheKey(parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export class CacheStore {
  get<T>(key: string): T | null {
    const row = db.prepare("SELECT value, expires_at FROM cache_entries WHERE cache_key = ?").get(key) as
      | { value: string; expires_at: number | null }
      | undefined;
    if (!row) return null;
    if (row.expires_at && Date.now() > row.expires_at) {
      db.prepare("DELETE FROM cache_entries WHERE cache_key = ?").run(key);
      return null;
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  getPath(key: string): string | null {
    const row = db.prepare("SELECT path, expires_at FROM cache_entries WHERE cache_key = ?").get(key) as
      | { path: string | null; expires_at: number | null }
      | undefined;
    if (!row?.path) return null;
    if (row.expires_at && Date.now() > row.expires_at) return null;
    return fs.existsSync(row.path) ? row.path : null;
  }

  set(key: string, kind: string, value: unknown, ttlMs?: number, filePath?: string): void {
    db.prepare(
      `INSERT INTO cache_entries (cache_key, kind, value, path, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET value=excluded.value, path=excluded.path, expires_at=excluded.expires_at`,
    ).run(
      key,
      kind,
      JSON.stringify(value),
      filePath ?? null,
      ttlMs ? Date.now() + ttlMs : null,
      nowIso(),
    );
  }

  fileDir(kind: string): string {
    const dir = path.join(config.dataDir, "cache", kind);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}

export const cache = new CacheStore();
