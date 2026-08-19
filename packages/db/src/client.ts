import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(dbPath: string): { db: Db; raw: Database.Database } {
  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");

  const db = drizzle(raw, { schema });
  return { db, raw };
}

export * as schema from "./schema.js";
