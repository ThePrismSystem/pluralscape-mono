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

// ── Bun SQLite driver factory ────────────────────────────────────────

/**
 * Database interface matching `bun:sqlite`'s Database class.
 * Declared here to avoid a hard dependency on bun-types in the sync package.
 */
interface BunSqliteDatabase {
  prepare(sql: string): {
    run(...params: unknown[]): void;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  exec(sql: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

/** Wraps a bun:sqlite Database as a SqliteDriver. */
export function createBunSqliteDriver(db: BunSqliteDatabase): SqliteDriver {
  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): void {
          stmt.run(...params);
        },
        all(...params: unknown[]): TRow[] {
          return stmt.all(...params) as TRow[];
        },
        get(...params: unknown[]): TRow | undefined {
          return (stmt.get(...params) as TRow | null) ?? undefined;
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      const txn = db.transaction(fn);
      return txn();
    },
    close(): void {
      db.close();
    },
  };
}
