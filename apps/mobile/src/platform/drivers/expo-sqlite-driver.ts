import { openDatabaseSync, type SQLiteBindParams, type SQLiteDatabase } from "expo-sqlite";

import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

const DB_NAME = "pluralscape-sync.db";

/**
 * Wraps expo-sqlite into the SqliteDriver interface used by @pluralscape/sync adapters.
 * expo-sqlite uses a synchronous API under the hood (JSI), wrapped in our interface.
 */
export async function createExpoSqliteDriver(): Promise<SqliteDriver> {
  // expo-sqlite is synchronous (JSI); we use await Promise.resolve() to satisfy
  // the @typescript-eslint/require-await rule while keeping the async signature.
  await Promise.resolve();

  const db: SQLiteDatabase = openDatabaseSync(DB_NAME);

  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepareSync(sql);
      return {
        run(...params: unknown[]): void {
          stmt.executeSync(params as SQLiteBindParams);
        },
        all(...params: unknown[]): TRow[] {
          const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
          return result.getAllSync();
        },
        get(...params: unknown[]): TRow | undefined {
          const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
          const first = result.getFirstSync();
          return first ?? undefined;
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
}
