export interface Stmt {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface AppDb {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  close(): void;
  engine: "sqlite" | "postgres";
}

/** Rewrites SQLite-flavored SQL for PostgreSQL. App request path stays SQLite. */
export function toPostgres(sql: string): string {
  const ignore = /INSERT OR IGNORE INTO/i.test(sql);
  const replace = /INSERT OR REPLACE INTO/i.test(sql);
  let i = 0;
  let out = sql
    .replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO")
    .replace(/INSERT OR REPLACE INTO/gi, "INSERT INTO")
    .replace(/\?/g, () => {
      i += 1;
      return `$${i}`;
    });
  if (ignore && !/ON CONFLICT/i.test(out)) {
    out = `${out} ON CONFLICT DO NOTHING`;
  }
  if (replace && !/ON CONFLICT/i.test(out)) {
    out = `${out} ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id`;
  }
  return out;
}
