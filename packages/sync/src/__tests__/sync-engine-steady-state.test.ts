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
  deriveMasterKey,
  generateIdentityKeypair,
  generateSalt,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DocumentKeyResolver } from "../document-key-resolver.js";
import { SyncEngine } from "../engine/sync-engine.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { UnixMillis } from "@pluralscape/types";

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
  masterKey = await deriveMasterKey("steady-state-test-password", salt, "mobile");
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
  systemId: "sys_test",
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
    systemId: "sys_test",
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
      const seq = await engine.applyLocalChange("system-core-sys_test", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_test"] = { value: "hello" };
      });

      expect(seq).toBe(1);
      expect(appendChange).toHaveBeenCalledTimes(1);
    });

    it("updates sync state after successful submission", async () => {
      const engine = await createBootstrappedEngine();

      await engine.applyLocalChange("system-core-sys_test", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_test2"] = { value: 1 };
      });

      const state = engine.getSyncState("system-core-sys_test");
      expect(state?.lastSyncedSeq).toBe(1);
    });

    it("increments seq on successive changes", async () => {
      const relay = new EncryptedRelay();
      const engine = await createBootstrappedEngine({
        networkAdapter: relayNetworkAdapter(relay),
      });

      const seq1 = await engine.applyLocalChange("system-core-sys_test", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_a"] = { v: 1 };
      });
      const seq2 = await engine.applyLocalChange("system-core-sys_test", (doc) => {
        const d = doc as Record<string, Record<string, unknown>>;
        d["_b"] = { v: 2 };
      });

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it("throws for non-existent document", async () => {
      const engine = await createBootstrappedEngine();

      await expect(
        engine.applyLocalChange("nonexistent-sys_abc", () => {
          /* no-op */
        }),
      ).rejects.toThrow("No active session");
    });
  });

  describe("handleIncomingChanges", () => {
    it("applies encrypted changes and persists locally", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys("system-core-sys_test");

      // Create a sender session with a fresh doc to produce valid changes
      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: "system-core-sys_test",
        sodium,
      });

      const envelope = senderSession.change((d) => {
        const doc = d as Record<string, unknown>;
        (doc["items"] as Record<string, string>)["key1"] = "value1";
      });

      const change: EncryptedChangeEnvelope = { ...envelope, seq: 10 };

      const appendChange = vi.fn().mockResolvedValue(undefined);
      const engine = await createBootstrappedEngine({
        storageAdapter: mockStorageAdapter({ appendChange }),
      });

      await engine.handleIncomingChanges("system-core-sys_test", [change]);

      expect(appendChange).toHaveBeenCalledWith("system-core-sys_test", change);
    });

    it("updates lastSyncedSeq to highest seq in batch", async () => {
      const keyResolver = createKeyResolver();
      const keys = keyResolver.resolveKeys("system-core-sys_test");

      const doc = Automerge.from<Record<string, unknown>>({ counter: 0 });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: "system-core-sys_test",
        sodium,
      });

      const e1 = senderSession.change((d) => {
        (d as Record<string, unknown>)["counter"] = 1;
      });
      const e2 = senderSession.change((d) => {
        (d as Record<string, unknown>)["counter"] = 2;
      });

      const changes: EncryptedChangeEnvelope[] = [
        { ...e1, seq: 3 },
        { ...e2, seq: 7 },
      ];

      const engine = await createBootstrappedEngine();
      await engine.handleIncomingChanges("system-core-sys_test", changes);

      const state = engine.getSyncState("system-core-sys_test");
      expect(state?.lastSyncedSeq).toBe(7);
    });

    it("ignores changes for unknown documents", async () => {
      const engine = await createBootstrappedEngine();
      await engine.handleIncomingChanges("unknown-sys_test", []);
    });
  });
});
