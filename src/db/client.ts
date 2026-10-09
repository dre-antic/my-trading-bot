import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let singleton: Database.Database | null = null;

export function dbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  return path.join(process.cwd(), "data", "atcc.sqlite");
}

export function getDb(): Database.Database {
  if (singleton) return singleton;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  singleton = db;
  return db;
}

export function resetDbForTests(file: string): Database.Database {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  process.env.DATABASE_PATH = file;
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return getDb();
}

export function closeDb(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
