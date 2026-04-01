import { openDatabaseSync, type SQLiteBindParams, type SQLiteDatabase } from "expo-sqlite";

import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

const DB_NAME = "pluralscape-sync.db";

/**
 * Wraps expo-sqlite into the SqliteDriver interface used by @pluralscape/sync adapters.
 * expo-sqlite uses a synchronous API under the hood (JSI), wrapped in our interface.
 *
 * Each run/all/get call prepares, executes, and finalizes the statement in one shot to
 * prevent native statement handle leaks.
 */
export function createExpoSqliteDriver(): Promise<SqliteDriver> {
  const db: SQLiteDatabase = openDatabaseSync(DB_NAME);

  const driver: SqliteDriver = {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      return {
        run(...params: unknown[]): void {
          const stmt = db.prepareSync(sql);
          try {
            stmt.executeSync(params as SQLiteBindParams);
          } finally {
            stmt.finalizeSync();
          }
        },
        all(...params: unknown[]): TRow[] {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            return result.getAllSync();
          } finally {
            stmt.finalizeSync();
          }
        },
        get(...params: unknown[]): TRow | undefined {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            const first = result.getFirstSync();
            return first ?? undefined;
          } finally {
            stmt.finalizeSync();
          }
        },
      };
    },

    exec(sql: string): void {
      db.execSync(sql);
    },

    transaction<T>(fn: () => T): T {
      let result!: T;
      db.withTransactionSync(() => {
        result = fn();
      });
      return result;
    },

    close(): void {
      db.closeSync();
    },
  };

  return Promise.resolve(driver);
}
