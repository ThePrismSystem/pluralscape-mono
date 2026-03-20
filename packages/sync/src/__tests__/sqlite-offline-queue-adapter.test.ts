/**
 * SQLite offline queue adapter contract tests.
 * Uses better-sqlite3-multiple-ciphers for Node/vitest compatibility.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe } from "vitest";

import { SqliteOfflineQueueAdapter } from "../adapters/sqlite-offline-queue-adapter.js";

import { createBetterSqliteDriver } from "./better-sqlite-driver.js";
import { runOfflineQueueAdapterContract } from "./offline-queue-adapter.contract.js";

describe("SqliteOfflineQueueAdapter (better-sqlite3)", () => {
  const databases: InstanceType<typeof Database>[] = [];

  function createAdapter(): SqliteOfflineQueueAdapter {
    const db = new Database(":memory:");
    databases.push(db);
    return new SqliteOfflineQueueAdapter(createBetterSqliteDriver(db));
  }

  afterEach(() => {
    for (const db of databases) {
      db.close();
    }
    databases.length = 0;
  });

  runOfflineQueueAdapterContract(createAdapter);
});
