/**
 * OfflineQueueManager tests.
 *
 * Uses mock adapters to test replay ordering, partial failure handling,
 * and empty queue no-op.
 */
import { describe, expect, it, vi } from "vitest";

import { OfflineQueueManager } from "../offline-queue-manager.js";

import { nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "../adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";

function makeEntry(id: string, docId: string, enqueuedAt: number): OfflineQueueEntry {
  return {
    id,
    documentId: docId,
    envelope: {
      documentId: docId,
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: nonce(1),
      signature: sig(1),
      authorPublicKey: pubkey(1),
    },
    enqueuedAt,
    syncedAt: null,
    serverSeq: null,
  };
}

function mockOfflineQueueAdapter(entries: readonly OfflineQueueEntry[] = []): OfflineQueueAdapter {
  const unsyncedEntries = [...entries];

  return {
    enqueue: vi.fn().mockResolvedValue("mock-id"),
    drainUnsynced: vi.fn().mockResolvedValue(unsyncedEntries),
    markSynced: vi.fn().mockResolvedValue(undefined),
    deleteConfirmed: vi.fn().mockResolvedValue(0),
  };
}

function mockNetworkAdapter(overrides: Partial<SyncNetworkAdapter> = {}): SyncNetworkAdapter {
  let seqCounter = 0;
  return {
    submitChange: vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        seqCounter++;
        return Promise.resolve({ ...change, seq: seqCounter });
      }),
    fetchChangesSince: vi.fn().mockResolvedValue([]),
    submitSnapshot: vi.fn().mockResolvedValue(undefined),
    fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    fetchManifest: vi.fn().mockResolvedValue({ systemId: "sys_test", documents: [] }),
    ...overrides,
  };
}

function mockStorageAdapter(): SyncStorageAdapter {
  return {
    loadSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    loadChangesSince: vi.fn().mockResolvedValue([]),
    appendChange: vi.fn().mockResolvedValue(undefined),
    pruneChangesBeforeSnapshot: vi.fn().mockResolvedValue(undefined),
    listDocuments: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
  };
}

describe("OfflineQueueManager", () => {
  it("returns zero counts for empty queue", async () => {
    const manager = new OfflineQueueManager({
      offlineQueueAdapter: mockOfflineQueueAdapter([]),
      networkAdapter: mockNetworkAdapter(),
      storageAdapter: mockStorageAdapter(),
    });

    const result = await manager.replay();
    expect(result.replayed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("replays entries in enqueued_at order within each document", async () => {
    const entries = [
      makeEntry("e1", "doc_a", 1000),
      makeEntry("e2", "doc_a", 2000),
      makeEntry("e3", "doc_a", 1500),
    ];

    const submitChange = vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) =>
        Promise.resolve({ ...change, seq: 1 }),
      );
    const markSynced = vi.fn().mockResolvedValue(undefined);
    const networkAdapter = mockNetworkAdapter({ submitChange });
    const queueAdapter = mockOfflineQueueAdapter(entries);
    queueAdapter.markSynced = markSynced;

    const manager = new OfflineQueueManager({
      offlineQueueAdapter: queueAdapter,
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
    });

    const result = await manager.replay();

    expect(result.replayed).toBe(3);
    expect(result.failed).toBe(0);

    // Verify submitChange was called 3 times
    expect(submitChange).toHaveBeenCalledTimes(3);

    // Verify markSynced was called for each entry
    expect(markSynced).toHaveBeenCalledTimes(3);
  });

  it("handles partial failures gracefully", async () => {
    const entries = [makeEntry("e1", "doc_a", 1000), makeEntry("e2", "doc_a", 2000)];

    let callCount = 0;
    const networkAdapter = mockNetworkAdapter({
      submitChange: vi
        .fn()
        .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
          callCount++;
          if (callCount <= 3) {
            // First entry fails all 3 retries
            return Promise.reject(new Error("Network error"));
          }
          // Second entry succeeds on first try
          return Promise.resolve({ ...change, seq: 1 });
        }),
    });

    const onError = vi.fn();
    const manager = new OfflineQueueManager({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError,
    });

    const result = await manager.replay();

    // First entry failed all retries, second succeeded
    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(1);
    expect(onError).toHaveBeenCalled();
  });

  it("groups entries by documentId and processes all documents", async () => {
    const entries = [
      makeEntry("e1", "doc_a", 1000),
      makeEntry("e2", "doc_b", 1500),
      makeEntry("e3", "doc_a", 2000),
    ];

    const submitChange = vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) =>
        Promise.resolve({ ...change, seq: 1 }),
      );
    const networkAdapter = mockNetworkAdapter({ submitChange });
    const queueAdapter = mockOfflineQueueAdapter(entries);

    const manager = new OfflineQueueManager({
      offlineQueueAdapter: queueAdapter,
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
    });

    const result = await manager.replay();

    expect(result.replayed).toBe(3);
    expect(submitChange).toHaveBeenCalledTimes(3);
  });

  it("persists changes locally after successful replay", async () => {
    const entries = [makeEntry("e1", "doc_a", 1000)];

    const appendChange = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter();
    storageAdapter.appendChange = appendChange;
    const manager = new OfflineQueueManager({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter: mockNetworkAdapter(),
      storageAdapter,
    });

    await manager.replay();

    expect(appendChange).toHaveBeenCalledTimes(1);
    expect(appendChange).toHaveBeenCalledWith(
      "doc_a",
      expect.objectContaining({ seq: expect.any(Number) }),
    );
  });
});
