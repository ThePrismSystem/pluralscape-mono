/**
 * Shared test helper: wraps better-sqlite3-multiple-ciphers as an async SqliteDriver.
 *
 * better-sqlite3 is natively synchronous; we wrap each call with Promise.resolve
 * to satisfy the async SqliteDriver contract.
 */
import Database from "better-sqlite3-multiple-ciphers";

import type { SqliteDriver, SqliteStatement } from "../adapters/sqlite-driver.js";

export function createBetterSqliteDriver(db: InstanceType<typeof Database>): SqliteDriver {
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
          return Promise.resolve((stmt.get(...params) as TRow | undefined) ?? undefined);
        },
      };
    },
    exec(sql: string): Promise<void> {
      db.exec(sql);
      return Promise.resolve();
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      // better-sqlite3's db.transaction expects a sync fn. Wrap BEGIN/COMMIT/ROLLBACK
      // manually so the fn can await. Preserve any original error when rollback itself
      // throws, matching the bun driver.
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
