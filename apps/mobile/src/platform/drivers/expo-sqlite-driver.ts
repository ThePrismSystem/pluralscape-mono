// Stub — real Expo SQLite driver implemented in Task 2.
import type { SqliteDriver } from "@pluralscape/sync/adapters";

export function createExpoSqliteDriver(): Promise<SqliteDriver> {
  return Promise.reject(new Error("Expo SQLite driver not yet implemented (Task 2)"));
}
