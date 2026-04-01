// Stub — real OPFS wa-sqlite driver implemented in Task 3.
import type { SqliteDriver } from "@pluralscape/sync/adapters";

export function createOpfsSqliteDriver(): Promise<SqliteDriver> {
  return Promise.reject(new Error("OPFS SQLite driver not yet implemented (Task 3)"));
}
