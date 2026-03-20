/**
 * Minimal SQLite driver interface implementable by both bun:sqlite and expo-sqlite.
 * Raw SQL — not Drizzle — since this is a client-side local store with 2 tables.
 */

/** A prepared statement that can be run or queried. */
export interface SqliteStatement<TRow = Record<string, unknown>> {
  run(...params: unknown[]): void;
  all(...params: unknown[]): TRow[];
  get(...params: unknown[]): TRow | undefined;
}

/** Minimal SQLite driver abstraction. */
export interface SqliteDriver {
  /** Prepare a SQL statement for repeated execution. */
  prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow>;

  /** Execute raw SQL (for DDL like CREATE TABLE). */
  exec(sql: string): void;

  /** Run a function inside a transaction. Rollback on throw. */
  transaction<T>(fn: () => T): T;

  /** Close the database connection. */
  close(): void;
}
