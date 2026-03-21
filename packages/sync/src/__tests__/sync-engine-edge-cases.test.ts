/**
 * SyncEngine edge-case tests (T-H2).
 *
 * Tests: replayOfflineQueue when adapter not configured (no-op),
 * replay with mixed success/failure, applyIncomingChanges when
 * conflictPersistenceAdapter.saveConflicts fails, dispose() with
 * active subscriptions, and adapter close() invocation in dispose().
 */
import * as Automerge from "@automerge/automerge";
import {
  configureSodium,
  createBucketKeyCache,
  deriveMasterKey,
  generateIdentityKeypair,
  generateSalt,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DocumentKeyResolver } from "../document-key-resolver.js";
import { SyncEngine } from "../engine/sync-engine.js";
import * as postMergeValidator from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { SystemId, UnixMillis } from "@pluralscape/types";

// ── Shared setup ─────────────────────────────────────────────────────

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  const salt = generateSalt();
  masterKey = await deriveMasterKey("edge-case-test-password", salt, "mobile");
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  bucketKeyCache.clearAll();
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SYSTEM_CORE_MANIFEST: SyncManifest = {
  systemId: "sys_test" as SystemId,
  documents: [
    {
      docId: "system-core-sys_test",
      docType: "system-core",
      keyType: "derived",
      bucketId: null,
      channelId: null,
      timePeriod: null,
      createdAt: 1000 as UnixMillis,
      updatedAt: 1000 as UnixMillis,
      sizeBytes: 0,
      snapshotVersion: 0,
      lastSeq: 0,
      archived: false,
    },
  ],
};

function createKeyResolver(): DocumentKeyResolver {
  return DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
}

function mockStorageAdapter(overrides: Partial<SyncStorageAdapter> = {}): SyncStorageAdapter {
  return {
    loadSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    loadChangesSince: vi.fn().mockResolvedValue([]),
    appendChange: vi.fn().mockResolvedValue(undefined),
    pruneChangesBeforeSnapshot: vi.fn().mockResolvedValue(undefined),
    listDocuments: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function relayNetworkAdapter(relay: EncryptedRelay): SyncNetworkAdapter {
  return {
    submitChange: vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        const seq = relay.submit(change);
        return Promise.resolve({ ...change, seq });
      }),
    fetchChangesSince: vi.fn().mockImplementation((docId: string, sinceSeq: number) => {
      return Promise.resolve(relay.getEnvelopesSince(docId, sinceSeq));
    }),
    submitSnapshot: vi.fn().mockResolvedValue(undefined),
    fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
  };
}

async function createBootstrappedEngine(
  overrides: Partial<SyncEngineConfig> = {},
): Promise<SyncEngine> {
  const relay = new EncryptedRelay();
  const engine = new SyncEngine({
    networkAdapter: relayNetworkAdapter(relay),
    storageAdapter: mockStorageAdapter(),
    keyResolver: createKeyResolver(),
    sodium,
    profile: { profileType: "owner-full" },
    systemId: "sys_test" as SystemId,
    onError: vi.fn(),
    ...overrides,
  });
  await engine.bootstrap();
  return engine;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("SyncEngine edge cases", () => {
  describe("replayOfflineQueue without adapter", () => {
    it("is a no-op when offlineQueueAdapter is not configured", async () => {
      const engine = await createBootstrappedEngine();

      // Calling replayOfflineQueue manually should not throw
      await engine.replayOfflineQueue();

      // Engine remains functional
      expect(engine.getActiveDocIds()).toContain("system-core-sys_test");
      engine.dispose();
    });
  });

  describe("replay with mixed success/failure", () => {
    it("reports mixed results when some documents succeed and others fail", async () => {
      vi.useFakeTimers();

      const relay = new EncryptedRelay();
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys("system-core-sys_test");

      // Create valid encrypted envelopes
      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: "system-core-sys_test",
        sodium,
      });

      const envelope = senderSession.change((d) => {
        (d as Record<string, Record<string, string>>)["items"] = { key1: "value1" };
      });

      const networkAdapter = relayNetworkAdapter(relay);
      networkAdapter.submitChange = vi
        .fn()
        .mockImplementation(async (docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
          if (docId === "doc-fail") {
            throw new Error("Network error");
          }
          // doc-succeed gets through
          const seq = await relay.submit(change);
          return { ...change, seq };
        });

      const markSynced = vi.fn().mockResolvedValue(undefined);
      const drainUnsynced = vi.fn().mockResolvedValue([
        {
          id: "oq_fail_1",
          documentId: "doc-fail",
          envelope,
          enqueuedAt: 1000,
          syncedAt: null,
          serverSeq: null,
        },
        {
          id: "oq_ok_2",
          documentId: "doc-succeed",
          envelope,
          enqueuedAt: 2000,
          syncedAt: null,
          serverSeq: null,
        },
      ]);

      const onError = vi.fn();
      const engine = new SyncEngine({
        networkAdapter,
        storageAdapter: mockStorageAdapter(),
        keyResolver,
        sodium,
        profile: { profileType: "owner-full" },
        systemId: "sys_test" as SystemId,
        onError,
        offlineQueueAdapter: {
          enqueue: vi.fn().mockResolvedValue("mock-id"),
          drainUnsynced,
          markSynced,
          deleteConfirmed: vi.fn().mockResolvedValue(0),
        },
      });

      // Use fetchManifest that returns empty to avoid hydration issues during bootstrap
      networkAdapter.fetchManifest = vi
        .fn()
        .mockResolvedValue({ systemId: "sys_test" as SystemId, documents: [] });

      const bootstrapPromise = engine.bootstrap();
      await vi.advanceTimersByTimeAsync(10_000);
      await bootstrapPromise;

      // Retry failure messages should have been logged for doc-fail
      const retryErrors = onError.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("oq_fail_1"),
      );
      expect(retryErrors.length).toBeGreaterThanOrEqual(1);

      // Aggregate summary should report 1 failed, 0 skipped (different documents)
      expect(onError).toHaveBeenCalledWith(expect.stringContaining("1 failed, 0 skipped"), null);

      // The succeeding entry should have been marked synced
      expect(markSynced).toHaveBeenCalledWith("oq_ok_2", expect.any(Number));

      engine.dispose();
      vi.useRealTimers();
    });
  });

  describe("applyIncomingChanges conflict persistence failure", () => {
    it("logs error when conflictPersistenceAdapter.saveConflicts fails", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys("system-core-sys_test");

      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: "system-core-sys_test",
        sodium,
      });

      const envelope = senderSession.change((d) => {
        (d as Record<string, Record<string, string>>)["items"] = { key1: "value1" };
      });

      const change: EncryptedChangeEnvelope = { ...envelope, seq: 10 };

      const saveConflicts = vi.fn().mockRejectedValue(new Error("DB write failed"));
      const conflictPersistenceAdapter: ConflictPersistenceAdapter = {
        saveConflicts,
        deleteOlderThan: vi.fn().mockResolvedValue(0),
      };

      // Stub runAllValidations to produce a fake notification so
      // persistConflicts is reliably triggered
      const fakeNotification: ConflictNotification = {
        entityType: "test",
        entityId: "test-1",
        fieldName: "value",
        resolution: "lww-field",
        detectedAt: Date.now(),
        summary: "test conflict",
      };
      vi.spyOn(postMergeValidator, "runAllValidations").mockReturnValue({
        cycleBreaks: [],
        sortOrderPatches: [],
        checkInNormalizations: 0,
        friendConnectionNormalizations: 0,
        correctionEnvelopes: [],
        notifications: [fakeNotification],
        errors: [],
      });

      const onError = vi.fn();
      const engine = await createBootstrappedEngine({
        conflictPersistenceAdapter,
        onError,
      });

      // Apply incoming changes - should not throw even if persistence fails
      await engine.handleIncomingChanges("system-core-sys_test", [change]);

      // saveConflicts was called with the fake notification
      expect(saveConflicts).toHaveBeenCalled();
      // Error was reported via onError
      expect(onError).toHaveBeenCalledWith("Failed to persist conflict records", expect.any(Error));
      // Engine remains functional
      expect(engine.getActiveDocIds()).toContain("system-core-sys_test");

      engine.dispose();
    });
  });

  describe("dispose() with active subscriptions", () => {
    it("unsubscribes all and clears state even if a subscription throws", async () => {
      const throwingUnsubscribe = vi.fn().mockImplementation(() => {
        throw new Error("Unsubscribe failed");
      });
      const goodUnsubscribe = vi.fn();

      let subscribeCallCount = 0;
      const subscribe = vi.fn().mockImplementation(() => {
        subscribeCallCount++;
        // First subscription throws on unsubscribe, second doesn't
        if (subscribeCallCount === 1) {
          return { unsubscribe: throwingUnsubscribe };
        }
        return { unsubscribe: goodUnsubscribe };
      });

      const manifest: SyncManifest = {
        systemId: "sys_test" as SystemId,
        documents: [
          {
            docId: "system-core-sys_test",
            docType: "system-core",
            keyType: "derived",
            bucketId: null,
            channelId: null,
            timePeriod: null,
            createdAt: 1000 as UnixMillis,
            updatedAt: 1000 as UnixMillis,
            sizeBytes: 0,
            snapshotVersion: 0,
            lastSeq: 0,
            archived: false,
          },
          {
            docId: "fronting-sys_test",
            docType: "fronting",
            keyType: "derived",
            bucketId: null,
            channelId: null,
            timePeriod: null,
            createdAt: 1000 as UnixMillis,
            updatedAt: 1000 as UnixMillis,
            sizeBytes: 0,
            snapshotVersion: 0,
            lastSeq: 0,
            archived: false,
          },
        ],
      };

      const relay = new EncryptedRelay();
      const networkAdapter = relayNetworkAdapter(relay);
      networkAdapter.fetchManifest = vi.fn().mockResolvedValue(manifest);
      networkAdapter.subscribe = subscribe;

      const onError = vi.fn();
      const engine = await createBootstrappedEngine({
        networkAdapter,
        onError,
      });

      // dispose should not throw even if unsubscribe fails
      engine.dispose();

      // The throwing unsubscribe was called
      expect(throwingUnsubscribe).toHaveBeenCalled();
      // The error was reported
      expect(onError).toHaveBeenCalledWith(
        "Failed to unsubscribe during dispose",
        expect.any(Error),
      );
      // State is still fully cleared
      expect(engine.getActiveDocIds()).toHaveLength(0);
    });

    it("calls close() on adapters that implement it", async () => {
      const networkClose = vi.fn();
      const storageClose = vi.fn();

      const relay = new EncryptedRelay();
      const networkAdapter = relayNetworkAdapter(relay);
      networkAdapter.close = networkClose;

      const storageAdapter = mockStorageAdapter();
      storageAdapter.close = storageClose;

      const engine = await createBootstrappedEngine({
        networkAdapter,
        storageAdapter,
      });

      engine.dispose();

      expect(networkClose).toHaveBeenCalledTimes(1);
      expect(storageClose).toHaveBeenCalledTimes(1);
    });

    it("does not call close() on adapters that do not implement it", async () => {
      const relay = new EncryptedRelay();
      const networkAdapter = relayNetworkAdapter(relay);
      // Ensure no close method — adapters from relayNetworkAdapter don't have close by default

      const storageAdapter = mockStorageAdapter();
      // Ensure no close method — mockStorageAdapter doesn't include close by default

      const onError = vi.fn();
      const engine = await createBootstrappedEngine({
        networkAdapter,
        storageAdapter,
        onError,
      });

      // Should not throw
      engine.dispose();

      // No errors reported
      const closeErrors = onError.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("close"),
      );
      expect(closeErrors).toHaveLength(0);
    });

    it("catches async rejection from close() and reports via onError", async () => {
      const closeError = new Error("Async close failed");
      const networkClose = vi.fn().mockRejectedValue(closeError);

      const relay = new EncryptedRelay();
      const networkAdapter = relayNetworkAdapter(relay);
      networkAdapter.close = networkClose;

      const onError = vi.fn();
      const engine = await createBootstrappedEngine({
        networkAdapter,
        onError,
      });

      engine.dispose();

      // Wait for the async rejection to be caught
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          "Failed to close network adapter during dispose",
          closeError,
        );
      });
    });
  });

  describe("applyLocalChange with network failure", () => {
    it("enqueues locally and propagates network error to caller", async () => {
      const enqueue = vi.fn().mockResolvedValue("oq_1");
      const offlineQueueAdapter = {
        enqueue,
        drainUnsynced: vi.fn().mockResolvedValue([]),
        markSynced: vi.fn().mockResolvedValue(undefined),
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const networkError = new Error("Connection refused");
      const relay = new EncryptedRelay();
      const networkAdapter = relayNetworkAdapter(relay);
      networkAdapter.submitChange = vi.fn().mockRejectedValue(networkError);

      const onError = vi.fn();
      const engine = await createBootstrappedEngine({
        networkAdapter,
        offlineQueueAdapter,
        onError,
      });

      // applyLocalChange should reject with the network error
      await expect(
        engine.applyLocalChange("system-core-sys_test", (doc) => {
          const d = doc as Record<string, Record<string, string>>;
          d["test_key"] = { value: "test" };
        }),
      ).rejects.toThrow("Connection refused");

      // Entry was enqueued before the network failure
      expect(enqueue).toHaveBeenCalledTimes(1);

      engine.dispose();
    });
  });
});
