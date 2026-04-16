/**
 * Shared test helper: wraps better-sqlite3-multiple-ciphers as an async SqliteDriver.
 *
 * better-sqlite3 is natively synchronous; we wrap each call with Promise.resolve
 * to satisfy the async SqliteDriver contract.
 */
import Database from "better-sqlite3-multiple-ciphers";

import { runAsyncTransaction } from "../adapters/sqlite-driver.js";

import type { SqliteDriver, SqliteStatement } from "../adapters/sqlite-driver.js";

export function createBetterSqliteDriver(db: InstanceType<typeof Database>): SqliteDriver {
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
          return Promise.resolve((stmt.get(...params) as TRow | undefined) ?? undefined);
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
