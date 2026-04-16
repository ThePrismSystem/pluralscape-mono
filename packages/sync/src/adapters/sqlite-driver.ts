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
   * Nested transactions are not supported and are rejected synchronously at
   * the driver level with a clear error message before any SQL is issued.
   */
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;

  /** Close the database connection. */
  close(): Promise<void>;
}

// ── Shared transaction helper ────────────────────────────────────────

/**
 * Shared transaction runner used by all SqliteDriver implementations.
 *
 * Issues BEGIN, awaits `fn`, then COMMIT on success or ROLLBACK on failure.
 * When ROLLBACK itself throws, wraps both errors in an AggregateError so
 * neither is lost. When COMMIT fails, attempts a best-effort ROLLBACK to
 * leave the connection in a known state and throws the commit error
 * (wrapped if the rollback also fails).
 *
 * Not reentrant — callers must guard against nested invocations before
 * entering.
 */
export async function runAsyncTransaction<T>(
  exec: (sql: string) => void | Promise<void>,
  fn: () => T | Promise<T>,
): Promise<T> {
  await exec("BEGIN");
  let result: T;
  try {
    result = await fn();
  } catch (err) {
    try {
      await exec("ROLLBACK");
    } catch (rollbackErr) {
      throw new AggregateError([err, rollbackErr], "transaction failed and rollback also failed");
    }
    throw err;
  }
  try {
    await exec("COMMIT");
  } catch (commitErr) {
    try {
      await exec("ROLLBACK");
    } catch (rollbackErr) {
      throw new AggregateError(
        [commitErr, rollbackErr],
        "commit failed and subsequent rollback also failed",
      );
    }
    throw commitErr;
  }
  return result;
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
  close(): void;
}

/** Wraps a bun:sqlite Database as an async SqliteDriver. */
export function createBunSqliteDriver(db: BunSqliteDatabase): SqliteDriver {
  let txDepth = 0;
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
    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      if (txDepth > 0) {
        throw new Error("SqliteDriver.transaction: nested transactions are not supported");
      }
      txDepth++;
      try {
        return await runAsyncTransaction((sql) => {
          db.exec(sql);
        }, fn);
      } finally {
        txDepth--;
      }
    },
    close(): Promise<void> {
      db.close();
      return Promise.resolve();
    },
  };
}
