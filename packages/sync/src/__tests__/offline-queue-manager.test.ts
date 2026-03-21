/**
 * replayOfflineQueue tests.
 *
 * Uses mock adapters to test replay ordering, partial failure handling,
 * causal ordering, and empty queue no-op.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { replayOfflineQueue } from "../offline-queue-manager.js";
import { DRAIN_BATCH_SIZE } from "../sync.constants.js";

import { docId, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "../adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";

function makeEntry(id: string, rawId: string, enqueuedAt: number): OfflineQueueEntry {
  return {
    id,
    documentId: docId(rawId),
    envelope: {
      documentId: docId(rawId),
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

describe("replayOfflineQueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero counts for empty queue", async () => {
    const result = await replayOfflineQueue({
      offlineQueueAdapter: mockOfflineQueueAdapter([]),
      networkAdapter: mockNetworkAdapter(),
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

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

    const result = await replayOfflineQueue({
      offlineQueueAdapter: queueAdapter,
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

    expect(result.replayed).toBe(3);
    expect(result.failed).toBe(0);

    // Verify submitChange was called 3 times
    expect(submitChange).toHaveBeenCalledTimes(3);

    // Verify markSynced was called for each entry
    expect(markSynced).toHaveBeenCalledTimes(3);

    // Verify markSynced was called in enqueuedAt order: e1 (1000), e3 (1500), e2 (2000)
    // markSynced(entry.id, sequenced.seq) per the offline-queue-manager
    const syncedEntryIds = markSynced.mock.calls.map((call: unknown[]) => call[0]) as string[];
    expect(syncedEntryIds).toEqual(["e1", "e3", "e2"]);
  });

  it("handles partial failures gracefully", async () => {
    vi.useFakeTimers();

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
          // Second entry would succeed but is skipped due to causal ordering
          return Promise.resolve({ ...change, seq: 1 });
        }),
    });

    const onError = vi.fn();
    const replayPromise = replayOfflineQueue({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError,
    });

    // Advance past all backoff delays
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await replayPromise;

    // First entry failed all retries, second is skipped (causal ordering)
    expect(result.replayed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(onError).toHaveBeenCalled();

    vi.useRealTimers();
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

    const result = await replayOfflineQueue({
      offlineQueueAdapter: queueAdapter,
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

    expect(result.replayed).toBe(3);
    expect(submitChange).toHaveBeenCalledTimes(3);
  });

  it("processes multiple documents concurrently with bounded parallelism", async () => {
    // Create entries for 4 different documents
    const entries = [
      makeEntry("e1", "doc_a", 1000),
      makeEntry("e2", "doc_b", 1000),
      makeEntry("e3", "doc_c", 1000),
      makeEntry("e4", "doc_d", 1000),
    ];

    const documentsInFlight = new Set<string>();
    let maxConcurrentDocs = 0;

    // Gate pattern: all submits block until gate is opened
    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });

    const submitChange = vi
      .fn()
      .mockImplementation((docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        documentsInFlight.add(docId);
        maxConcurrentDocs = Math.max(maxConcurrentDocs, documentsInFlight.size);
        return gate.then(() => {
          documentsInFlight.delete(docId);
          return { ...change, seq: 1 } as EncryptedChangeEnvelope;
        });
      });

    const networkAdapter = mockNetworkAdapter({ submitChange });

    const replayPromise = replayOfflineQueue({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

    // Wait for workers to reach the gate (3 concurrent workers should start)
    await vi.waitFor(() => {
      expect(submitChange).toHaveBeenCalledTimes(3);
    });

    // Verify concurrency is bounded: at most 3 docs in flight
    expect(maxConcurrentDocs).toBeGreaterThan(1);
    expect(maxConcurrentDocs).toBeLessThanOrEqual(3);

    // Open the gate so all resolve, allowing the 4th doc to start
    openGate();

    const result = await replayPromise;

    expect(result.replayed).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("persists changes locally after successful replay", async () => {
    const entries = [makeEntry("e1", "doc_a", 1000)];

    const appendChange = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter();
    storageAdapter.appendChange = appendChange;

    const result = await replayOfflineQueue({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter: mockNetworkAdapter(),
      storageAdapter,
      onError: vi.fn(),
    });

    expect(result.replayed).toBe(1);
    expect(appendChange).toHaveBeenCalledTimes(1);
    expect(appendChange).toHaveBeenCalledWith(
      "doc_a",
      expect.objectContaining({ seq: expect.any(Number) }),
    );
  });

  it("skips remaining entries for a document when one fails (causal ordering)", async () => {
    vi.useFakeTimers();

    const entries = [
      makeEntry("e1", "doc_a", 1000),
      makeEntry("e2", "doc_a", 2000),
      makeEntry("e3", "doc_a", 3000),
    ];

    let callCount = 0;
    const networkAdapter = mockNetworkAdapter({
      submitChange: vi
        .fn()
        .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
          callCount++;
          if (callCount === 1) {
            // First entry succeeds
            return Promise.resolve({ ...change, seq: 1 });
          }
          // Second entry fails all retries
          return Promise.reject(new Error("Network error"));
        }),
    });

    const replayPromise = replayOfflineQueue({
      offlineQueueAdapter: mockOfflineQueueAdapter(entries),
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10_000);
    const result = await replayPromise;

    expect(result.replayed).toBe(1); // e1 succeeded
    expect(result.failed).toBe(1); // e2 failed
    expect(result.skipped).toBe(1); // e3 skipped due to causal dependency

    vi.useRealTimers();
  });

  it("drains multiple batches when queue exceeds DRAIN_BATCH_SIZE", async () => {
    // Build a full batch (DRAIN_BATCH_SIZE entries) + a partial second batch
    const fullBatch: OfflineQueueEntry[] = [];
    for (let i = 0; i < DRAIN_BATCH_SIZE; i++) {
      fullBatch.push(makeEntry(`e-full-${String(i)}`, "doc_a", i));
    }
    const partialBatch: OfflineQueueEntry[] = [
      makeEntry("e-partial-0", "doc_a", DRAIN_BATCH_SIZE),
      makeEntry("e-partial-1", "doc_a", DRAIN_BATCH_SIZE + 1),
    ];

    let drainCallCount = 0;
    const drainUnsynced = vi.fn().mockImplementation(() => {
      drainCallCount++;
      if (drainCallCount === 1) return Promise.resolve(fullBatch);
      return Promise.resolve(partialBatch);
    });

    const offlineQueueAdapter: OfflineQueueAdapter = {
      enqueue: vi.fn().mockResolvedValue("mock-id"),
      drainUnsynced,
      markSynced: vi.fn().mockResolvedValue(undefined),
      deleteConfirmed: vi.fn().mockResolvedValue(0),
    };

    const result = await replayOfflineQueue({
      offlineQueueAdapter,
      networkAdapter: mockNetworkAdapter(),
      storageAdapter: mockStorageAdapter(),
      onError: vi.fn(),
    });

    expect(drainUnsynced).toHaveBeenCalledTimes(2);
    expect(result.replayed).toBe(DRAIN_BATCH_SIZE + 2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("propagates error when drainUnsynced throws", async () => {
    const error = new Error("DB connection lost");
    const offlineQueueAdapter: OfflineQueueAdapter = {
      enqueue: vi.fn(),
      drainUnsynced: vi.fn().mockRejectedValue(error),
      markSynced: vi.fn(),
      deleteConfirmed: vi.fn(),
    };
    await expect(
      replayOfflineQueue({
        offlineQueueAdapter,
        networkAdapter: mockNetworkAdapter(),
        storageAdapter: mockStorageAdapter(),
        onError: vi.fn(),
      }),
    ).rejects.toThrow("DB connection lost");
  });
});
