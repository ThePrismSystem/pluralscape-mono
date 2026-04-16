import { generateAllDdl } from "@pluralscape/sync/materializer";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

const WAL_PRAGMA = "PRAGMA journal_mode=WAL";

export interface LocalDatabase {
  initialize(): Promise<void>;
  queryAll(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  queryOne(sql: string, params: unknown[]): Promise<Record<string, unknown> | undefined>;
  execute(sql: string, params: unknown[]): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createLocalDatabase(driver: SqliteDriver): LocalDatabase {
  return {
    async initialize(): Promise<void> {
      await driver.exec(WAL_PRAGMA);
      for (const stmt of generateAllDdl()) {
        await driver.exec(stmt);
      }
    },

    queryAll(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      return driver.prepare(sql).all(...params);
    },

    queryOne(sql: string, params: unknown[]): Promise<Record<string, unknown> | undefined> {
      return driver.prepare(sql).get(...params);
    },

    execute(sql: string, params: unknown[]): Promise<void> {
      return driver.prepare(sql).run(...params);
    },

    transaction<T>(fn: () => Promise<T>): Promise<T> {
      return driver.transaction(fn);
    },

    close(): Promise<void> {
      return driver.close();
    },
  };
}
