import fs from "node:fs";
import path from "node:path";
import { getDb } from "./client";

export function migrate(db = getDb()): void {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  db.exec(sql);
}

if (require.main === module) {
  migrate();
  console.log("migrations applied");
}
