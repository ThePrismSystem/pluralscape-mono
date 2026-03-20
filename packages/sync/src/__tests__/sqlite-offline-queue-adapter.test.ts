/**
 * SQLite offline queue adapter contract tests.
 * Uses better-sqlite3-multiple-ciphers for Node/vitest compatibility.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteOfflineQueueAdapter } from "../adapters/sqlite-offline-queue-adapter.js";

import { createBetterSqliteDriver } from "./better-sqlite-driver.js";
import { runOfflineQueueAdapterContract } from "./offline-queue-adapter.contract.js";
import { nonce, pubkey, sig } from "./test-crypto-helpers.js";

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

  // ── SQLite-specific tests ──────────────────────────────────────────

  it("close() does not throw", () => {
    const adapter = createAdapter();
    expect(() => {
      adapter.close();
    }).not.toThrow();
  });

  it("100 rapid enqueue calls produce 100 unique IDs", async () => {
    const adapter = createAdapter();
    const ids = new Set<string>();

    const envelope = {
      documentId: "doc_1",
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: nonce(1),
      signature: sig(1),
      authorPublicKey: pubkey(1),
    };

    for (let i = 0; i < 100; i++) {
      const id = await adapter.enqueue("doc_1", envelope);
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });

  it("drainUnsynced returns proper Uint8Array (not Buffer subclass)", async () => {
    const adapter = createAdapter();

    const envelope = {
      documentId: "doc_1",
      ciphertext: new Uint8Array([10, 20, 30]),
      nonce: nonce(1),
      signature: sig(1),
      authorPublicKey: pubkey(1),
    };

    await adapter.enqueue("doc_1", envelope);
    const entries = await adapter.drainUnsynced();

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry).toBeDefined();
    expect(entry?.envelope.ciphertext.constructor).toBe(Uint8Array);
    expect(entry?.envelope.nonce.constructor).toBe(Uint8Array);
    expect(entry?.envelope.signature.constructor).toBe(Uint8Array);
    expect(entry?.envelope.authorPublicKey.constructor).toBe(Uint8Array);
  });
});
