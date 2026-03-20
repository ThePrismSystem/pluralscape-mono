import type { SqliteDriver, SqliteStatement } from "./sqlite-driver.js";

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
