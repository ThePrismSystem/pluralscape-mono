import { generateAllDdl } from "@pluralscape/sync/materializer";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

const WAL_PRAGMA = "PRAGMA journal_mode=WAL";

export interface LocalDatabase {
  initialize(): void;
  queryAll(sql: string, params: unknown[]): Record<string, unknown>[];
  queryOne(sql: string, params: unknown[]): Record<string, unknown> | undefined;
  execute(sql: string, params: unknown[]): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

export function createLocalDatabase(driver: SqliteDriver): LocalDatabase {
  return {
    initialize(): void {
      driver.exec(WAL_PRAGMA);
      for (const stmt of generateAllDdl()) {
        driver.exec(stmt);
      }
    },

    queryAll(sql: string, params: unknown[]) {
      return driver.prepare(sql).all(...params);
    },

    queryOne(sql: string, params: unknown[]) {
      return driver.prepare(sql).get(...params);
    },

    execute(sql: string, params: unknown[]): void {
      driver.prepare(sql).run(...params);
    },

    transaction<T>(fn: () => T): T {
      return driver.transaction(fn);
    },

    close(): void {
      driver.close();
    },
  };
}
