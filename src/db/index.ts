import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { config, ensureDirs } from "../config/index.js";

ensureDirs();

const dbPath = path.join(config.dataDir, "aether.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db: DatabaseType = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  request_json TEXT NOT NULL,
  manifest_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  estimated_usd REAL NOT NULL,
  actual_usd REAL NOT NULL,
  paid INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_stats (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 70,
  availability_score REAL NOT NULL DEFAULT 80,
  free_quota_score REAL NOT NULL DEFAULT 80,
  speed_score REAL NOT NULL DEFAULT 70,
  cost_score REAL NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  last_latency_ms INTEGER,
  last_error TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cache_entries (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  path TEXT,
  expires_at INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS improvement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  component TEXT NOT NULL,
  license TEXT NOT NULL,
  commercial TEXT NOT NULL,
  attribution TEXT,
  notes TEXT,
  flagged INTEGER NOT NULL DEFAULT 0
);
`);

export function nowIso(): string {
  return new Date().toISOString();
}
