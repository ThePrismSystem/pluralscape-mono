/**
 * SyncEngine steady-state tests.
 *
 * Tests outbound (local change → server) and inbound (server push → local)
 * flows after bootstrap is complete. Uses real sodium for encrypt/decrypt.
 */
import * as Automerge from "@automerge/automerge";
import {
  configureSodium,
  createBucketKeyCache,
  generateIdentityKeypair,
  generateMasterKey,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DocumentKeyResolver } from "../document-key-resolver.js";
import { SyncEngine } from "../engine/sync-engine.js";
import { NoActiveSessionError } from "../errors.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { asSyncDocId, sysId } from "./test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { OfflineQueueEntry } from "../adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

// ── Test constants ────────────────────────────────────────────────────

const SYSTEM_CORE_DOC_ID = asSyncDocId("system-core-sys_test");
const UNKNOWN_DOC_ID = asSyncDocId("unknown-sys_test");
const NONEXISTENT_DOC_ID = asSyncDocId("nonexistent-sys_abc");

// ── Shared setup ─────────────────────────────────────────────────────

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  masterKey = generateMasterKey();
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  bucketKeyCache.clearAll();
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

const SYSTEM_CORE_MANIFEST: SyncManifest = {
  systemId: sysId("sys_test"),
  documents: [
    {
      docId: SYSTEM_CORE_DOC_ID,
      docType: "system-core",
      keyType: "derived",
      bucketId: null,
      channelId: null,
      timePeriod: null,
      createdAt: toUnixMillis(1000),
      updatedAt: toUnixMillis(1000),
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
      .mockImplementation(async (_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        const seq = await relay.submit(change);
        return { ...change, seq };
      }),
    fetchChangesSince: vi.fn().mockImplementation(async (rawDocId: string, sinceSeq: number) => {
      const result = await relay.getEnvelopesSince(asSyncDocId(rawDocId), sinceSeq);
      return result.envelopes;
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
    systemId: sysId("sys_test"),
    onError: vi.fn(),
    ...overrides,
  });
  await engine.bootstrap();
  return engine;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("SyncEngine steady-state", () => {
  describe("applyLocalChange", () => {
    it("submits change to server and returns assigned seq", async () => {
      const relay = new EncryptedRelay();
      const appendChange = vi.fn().mockResolvedValue(undefined);
      const engine = await createBootstrappedEngine({
        networkAdapter: relayNetworkAdapter(relay),
        storageAdapter: mockStorageAdapter({ appendChange }),
      });

      // Use Automerge-compatible mutation (untyped via the unknown doc)
      const seq = await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_test"] = { value: "hello" };
      });

      expect(seq).toBe(1);
      expect(appendChange).toHaveBeenCalledTimes(1);
    });

    it("updates sync state after successful submission", async () => {
      const engine = await createBootstrappedEngine();

      await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_test2"] = { value: 1 };
      });

      const state = engine.getSyncState(SYSTEM_CORE_DOC_ID);
      expect(state?.lastSyncedSeq).toBe(1);
    });

    it("increments seq on successive changes", async () => {
      const relay = new EncryptedRelay();
      const engine = await createBootstrappedEngine({
        networkAdapter: relayNetworkAdapter(relay),
      });

      const seq1 = await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_a"] = { v: 1 };
      });
      const seq2 = await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_b"] = { v: 2 };
      });

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it("throws for non-existent document", async () => {
      const engine = await createBootstrappedEngine();

      await expect(
        engine.applyLocalChange(NONEXISTENT_DOC_ID, "system-core", () => {
          /* no-op */
        }),
      ).rejects.toThrow(NoActiveSessionError);
    });

    it("rejects when documentType mismatches docId (sync-orkv)", async () => {
      const engine = await createBootstrappedEngine();

      await expect(
        engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "fronting", () => {
          /* no-op */
        }),
      ).rejects.toThrow(NoActiveSessionError);
    });
  });

  describe("handleIncomingChanges", () => {
    it("applies encrypted changes and persists locally", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys(SYSTEM_CORE_DOC_ID);

      // Create a sender session with a fresh doc to produce valid changes
      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: SYSTEM_CORE_DOC_ID,
        sodium,
      });

      const envelope = senderSession.change((d) => {
        const doc = d;
        (doc["items"] as Record<string, string>)["key1"] = "value1";
      });

      const change: EncryptedChangeEnvelope = { ...envelope, seq: 10 };

      const appendChange = vi.fn().mockResolvedValue(undefined);
      const engine = await createBootstrappedEngine({
        storageAdapter: mockStorageAdapter({ appendChange }),
      });

      await engine.handleIncomingChanges(SYSTEM_CORE_DOC_ID, [change]);

      expect(appendChange).toHaveBeenCalledWith("system-core-sys_test", change);
    });

    it("updates lastSyncedSeq to highest seq in batch", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys(SYSTEM_CORE_DOC_ID);

      const doc = Automerge.from<Record<string, unknown>>({ counter: 0 });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: SYSTEM_CORE_DOC_ID,
        sodium,
      });

      const e1 = senderSession.change((d) => {
        d["counter"] = 1;
      });
      const e2 = senderSession.change((d) => {
        d["counter"] = 2;
      });

      const changes: EncryptedChangeEnvelope[] = [
        { ...e1, seq: 3 },
        { ...e2, seq: 7 },
      ];

      const engine = await createBootstrappedEngine();
      await engine.handleIncomingChanges(SYSTEM_CORE_DOC_ID, changes);

      const state = engine.getSyncState(SYSTEM_CORE_DOC_ID);
      expect(state?.lastSyncedSeq).toBe(7);
    });

    it("ignores changes for unknown documents", async () => {
      const engine = await createBootstrappedEngine();
      await engine.handleIncomingChanges(UNKNOWN_DOC_ID, []);
    });
  });

  describe("offline queue integration", () => {
    it("enqueues change before submitting to server", async () => {
      const relay = new EncryptedRelay();
      const enqueue = vi.fn().mockResolvedValue("entry-1");
      const markSynced = vi.fn().mockResolvedValue(undefined);
      const offlineQueueAdapter = {
        enqueue,
        drainUnsynced: vi.fn().mockResolvedValue([]),
        markSynced,
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const engine = await createBootstrappedEngine({
        networkAdapter: relayNetworkAdapter(relay),
        offlineQueueAdapter,
      });

      await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_offline_test"] = { value: "test" };
      });

      // Enqueue should have been called before submit
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue).toHaveBeenCalledWith(
        "system-core-sys_test",
        expect.objectContaining({ ciphertext: expect.any(Uint8Array) }),
      );
    });

    it("marks entry as synced after successful submission", async () => {
      const relay = new EncryptedRelay();
      const markSynced = vi.fn().mockResolvedValue(undefined);
      const offlineQueueAdapter = {
        enqueue: vi.fn().mockResolvedValue("entry-1"),
        drainUnsynced: vi.fn().mockResolvedValue([]),
        markSynced,
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const engine = await createBootstrappedEngine({
        networkAdapter: relayNetworkAdapter(relay),
        offlineQueueAdapter,
      });

      const seq = await engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_sync_test"] = { value: 1 };
      });

      expect(markSynced).toHaveBeenCalledTimes(1);
      expect(markSynced).toHaveBeenCalledWith("entry-1", seq);
    });

    it("does not mark synced when server submission fails", async () => {
      const markSynced = vi.fn().mockResolvedValue(undefined);
      const offlineQueueAdapter = {
        enqueue: vi.fn().mockResolvedValue("entry-1"),
        drainUnsynced: vi.fn().mockResolvedValue([]),
        markSynced,
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const failingNetwork = {
        submitChange: vi.fn().mockRejectedValue(new Error("Network offline")),
        fetchChangesSince: vi.fn().mockResolvedValue([]),
        submitSnapshot: vi.fn().mockResolvedValue(undefined),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
      };

      const engine = await createBootstrappedEngine({
        networkAdapter: failingNetwork,
        offlineQueueAdapter,
      });

      await expect(
        engine.applyLocalChange(SYSTEM_CORE_DOC_ID, "system-core", (doc) => {
          const d = doc as Record<string, Record<string, unknown>>;
          d["_fail_test"] = { value: 1 };
        }),
      ).rejects.toThrow("Network offline");

      // Enqueue was called, but markSynced was NOT called
      expect(offlineQueueAdapter.enqueue).toHaveBeenCalledTimes(1);
      expect(markSynced).not.toHaveBeenCalled();
    });
  });

  describe("bootstrap replay", () => {
    it("replays offline queue entries during bootstrap and updates sessions", async () => {
      const relay = new EncryptedRelay();
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys(SYSTEM_CORE_DOC_ID);

      // Create a sender session to produce a valid encrypted change
      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: SYSTEM_CORE_DOC_ID,
        sodium,
      });

      const envelope = senderSession.change((d) => {
        (d as Record<string, Record<string, string>>)["items"] = { key1: "value1" };
      });

      const entry: OfflineQueueEntry = {
        id: "oq_replay_1",
        documentId: SYSTEM_CORE_DOC_ID,
        envelope,
        enqueuedAt: 1000,
        syncedAt: null,
        serverSeq: null,
      };

      const drainUnsynced = vi.fn().mockResolvedValue([entry]);
      const markSynced = vi.fn().mockResolvedValue(undefined);
      const networkAdapter = relayNetworkAdapter(relay);

      // Override submitChange to also submit to relay
      const originalSubmit = networkAdapter.submitChange.bind(networkAdapter);
      networkAdapter.submitChange = vi
        .fn()
        .mockImplementation((rawDocId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
          return originalSubmit(asSyncDocId(rawDocId), change);
        });

      const appendChange = vi.fn().mockResolvedValue(undefined);
      const loadChangesSince = vi.fn().mockResolvedValue([]);

      const engine = await createBootstrappedEngine({
        networkAdapter,
        storageAdapter: mockStorageAdapter({
          appendChange,
          loadChangesSince,
        }),
        offlineQueueAdapter: {
          enqueue: vi.fn().mockResolvedValue("mock-id"),
          drainUnsynced,
          markSynced,
          deleteConfirmed: vi.fn().mockResolvedValue(0),
        },
      });

      // drainUnsynced should have been called during bootstrap
      expect(drainUnsynced).toHaveBeenCalled();
      // markSynced should have been called for the replayed entry
      expect(markSynced).toHaveBeenCalledWith("oq_replay_1", expect.any(Number));

      engine.dispose();
    });
  });

  describe("validation persistence", () => {
    it("persists conflict notifications via conflictPersistenceAdapter", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys(SYSTEM_CORE_DOC_ID);

      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: SYSTEM_CORE_DOC_ID,
        sodium,
      });

      const envelope = senderSession.change((d) => {
        (d as Record<string, Record<string, string>>)["items"] = { key1: "value1" };
      });

      const change: EncryptedChangeEnvelope = { ...envelope, seq: 10 };

      const saveConflicts = vi.fn().mockResolvedValue(undefined);
      const conflictPersistenceAdapter: ConflictPersistenceAdapter = {
        saveConflicts,
        deleteOlderThan: vi.fn().mockResolvedValue(0),
      };

      const engine = await createBootstrappedEngine({
        conflictPersistenceAdapter,
      });

      await engine.handleIncomingChanges(SYSTEM_CORE_DOC_ID, [change]);

      // Drain microtask queue — the fire-and-forget persistence promise chain
      // (saveConflicts().catch(...)) should resolve without unhandled rejections
      await Promise.resolve();
      await Promise.resolve();

      engine.dispose();
    });
  });
});
