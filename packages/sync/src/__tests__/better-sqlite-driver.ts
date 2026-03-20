/**
 * Shared test helper: wraps better-sqlite3-multiple-ciphers as a SqliteDriver.
 *
 * This differs from production createBunSqliteDriver because better-sqlite3
 * uses a synchronous API and returns undefined (not null) for missing rows.
 */
import Database from "better-sqlite3-multiple-ciphers";

import type { SqliteDriver } from "../adapters/sqlite-driver.js";

export function createBetterSqliteDriver(db: InstanceType<typeof Database>): SqliteDriver {
  return {
    prepare<TRow = Record<string, unknown>>(sql: string) {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): void {
          stmt.run(...params);
        },
        all(...params: unknown[]): TRow[] {
          return stmt.all(...params) as TRow[];
        },
        get(...params: unknown[]): TRow | undefined {
          return (stmt.get(...params) as TRow | undefined) ?? undefined;
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
