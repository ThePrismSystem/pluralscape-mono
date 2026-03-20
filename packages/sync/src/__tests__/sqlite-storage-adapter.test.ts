/**
 * SQLite storage adapter contract tests.
 * Uses better-sqlite3-multiple-ciphers for Node/vitest compatibility.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe } from "vitest";

import { SqliteStorageAdapter } from "../adapters/sqlite-storage-adapter.js";

import { runStorageAdapterContract } from "./storage-adapter.contract.js";

import type { SqliteDriver } from "../adapters/sqlite-driver.js";

function createBetterSqliteDriver(db: InstanceType<typeof Database>): SqliteDriver {
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
  };
}

describe("SqliteStorageAdapter (better-sqlite3)", () => {
  const databases: InstanceType<typeof Database>[] = [];

  function createAdapter(): SqliteStorageAdapter {
    const db = new Database(":memory:");
    databases.push(db);
    return new SqliteStorageAdapter(createBetterSqliteDriver(db));
  }

  afterEach(() => {
    for (const db of databases) {
      db.close();
    }
    databases.length = 0;
  });

  runStorageAdapterContract(createAdapter);
});
