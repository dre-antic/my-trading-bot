import fs from "node:fs";
import path from "node:path";

export async function migratePostgres(url = process.env.DATABASE_URL): Promise<void> {
  if (!url) throw new Error("DATABASE_URL is required for PostgreSQL migrations");
  const pg = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.pg.sql"), "utf8");
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export function postgresTableNames(): string[] {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.pg.sql"), "utf8");
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
}

export function sqliteTableNames(): string[] {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
}

if (process.argv[1]?.endsWith("pg.ts")) {
  migratePostgres().then(() => console.log("postgres schema applied"));
}
