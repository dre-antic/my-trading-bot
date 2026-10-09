import { describe, expect, it } from "vitest";
import { toPostgres } from "@/db/adapter";
import { postgresTableNames, sqliteTableNames } from "@/db/pg";

describe("SQL adapter", () => {
  it("rewrites placeholders and OR IGNORE/REPLACE", () => {
    expect(toPostgres("SELECT * FROM users WHERE id = ?")).toBe("SELECT * FROM users WHERE id = $1");
    expect(toPostgres("INSERT OR IGNORE INTO instruments (id) VALUES (?)")).toBe(
      "INSERT INTO instruments (id) VALUES ($1) ON CONFLICT DO NOTHING",
    );
    expect(toPostgres("INSERT OR REPLACE INTO orders (id) VALUES (?)")).toMatch(/ON CONFLICT \(id\)/);
  });

  it("keeps SQLite and Postgres table names in parity", () => {
    expect(sqliteTableNames().sort()).toEqual(postgresTableNames().sort());
    expect(sqliteTableNames()).toEqual(expect.arrayContaining(["market_bar_cache", "notification_deliveries", "strategy_experiments"]));
  });
});
