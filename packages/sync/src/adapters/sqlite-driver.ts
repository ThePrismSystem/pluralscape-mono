/**
 * Minimal SQLite driver interface implementable by bun:sqlite, expo-sqlite,
 * and a main-thread proxy to a wa-sqlite Web Worker on web.
 * Raw SQL — not Drizzle — since this is a client-side local store with 2 tables.
 *
 * All methods return Promises. Sync-native drivers (bun:sqlite, better-sqlite3,
 * expo-sqlite) wrap their sync calls with Promise.resolve; the overhead is one
 * microtask per call. The OPFS driver on web uses this asyncness natively since
 * it proxies to a Worker over postMessage.
 */

/** A prepared statement that can be run or queried. */
export interface SqliteStatement<TRow = Record<string, unknown>> {
  run(...params: unknown[]): Promise<void>;
  all(...params: unknown[]): Promise<TRow[]>;
  get(...params: unknown[]): Promise<TRow | undefined>;
}

/** Minimal SQLite driver abstraction. */
export interface SqliteDriver {
  /** Prepare a SQL statement for repeated execution. */
  prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow>;

  /** Execute raw SQL (for DDL like CREATE TABLE). */
  exec(sql: string): Promise<void>;

  /**
   * Run a function inside a transaction. Rollback on throw.
   *
   * Nested transactions are not supported. Callers must not invoke
   * `transaction` from inside another `transaction` — the inner BEGIN will
   * fail with "cannot start a transaction within a transaction".
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /** Close the database connection. */
  close(): Promise<void>;
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

/** Wraps a bun:sqlite Database as an async SqliteDriver. */
export function createBunSqliteDriver(db: BunSqliteDatabase): SqliteDriver {
  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): Promise<void> {
          stmt.run(...params);
          return Promise.resolve();
        },
        all(...params: unknown[]): Promise<TRow[]> {
          return Promise.resolve(stmt.all(...params) as TRow[]);
        },
        get(...params: unknown[]): Promise<TRow | undefined> {
          return Promise.resolve((stmt.get(...params) as TRow | null) ?? undefined);
        },
      };
    },
    exec(sql: string): Promise<void> {
      db.exec(sql);
      return Promise.resolve();
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      // bun:sqlite's transaction wraps a sync fn. Since our fn is async, we
      // emulate BEGIN/COMMIT/ROLLBACK manually.
      db.exec("BEGIN");
      try {
        const result = await fn();
        db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch (rollbackErr) {
          throw new AggregateError(
            [err, rollbackErr],
            "transaction failed and rollback also failed",
          );
        }
        throw err;
      }
    },
    close(): Promise<void> {
      db.close();
      return Promise.resolve();
    },
  };
}
