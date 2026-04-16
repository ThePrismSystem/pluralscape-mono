/**
 * SQLite storage adapter contract tests.
 * Uses better-sqlite3-multiple-ciphers for Node/vitest compatibility.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe } from "vitest";

import { SqliteStorageAdapter } from "../adapters/sqlite-storage-adapter.js";

import { createBetterSqliteDriver } from "./better-sqlite-driver.js";
import { runStorageAdapterContract } from "./storage-adapter.contract.js";

describe("SqliteStorageAdapter (better-sqlite3)", () => {
  const databases: InstanceType<typeof Database>[] = [];

  async function createAdapter(): Promise<SqliteStorageAdapter> {
    const db = new Database(":memory:");
    databases.push(db);
    return SqliteStorageAdapter.create(createBetterSqliteDriver(db));
  }

  afterEach(() => {
    for (const db of databases) {
      db.close();
    }
    databases.length = 0;
  });

  runStorageAdapterContract(createAdapter);
});
