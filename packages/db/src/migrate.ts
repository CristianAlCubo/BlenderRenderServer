import type Database from "better-sqlite3";

import { migrations } from "./migrations.js";

export function runMigrations(raw: Database.Database): void {
  for (const migration of migrations) {
    raw.exec(migration.sql);
  }
}
