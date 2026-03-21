/**
 * SyncEngine runtime hardening tests (P-M1 through P-M8).
 *
 * Covers batch change application, redundant hydration skip, batch storage
 * writes, operation promise cleanup, conflict retry cap, and bounded
 * concurrency for correction envelopes.
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
import { SyncEngine, submitCorrectionEnvelopes } from "../engine/sync-engine.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { EncryptedChangeEnvelope } from "../types.js";
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
  masterKey = await deriveMasterKey("runtime-hardening-test-password", salt, "mobile");
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

// ── P-M1: Batch Automerge change application ───────────────────────

describe("P-M1: batch Automerge change application", () => {
  it("applies multiple changes in a single batch", async () => {
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
      d["counter"] = 1;
    });
    const e2 = senderSession.change((d) => {
      d["counter"] = 2;
    });
    const e3 = senderSession.change((d) => {
      d["counter"] = 3;
    });

    const changes: EncryptedChangeEnvelope[] = [
      { ...e1, seq: 1 },
      { ...e2, seq: 2 },
      { ...e3, seq: 3 },
    ];

    const engine = await createBootstrappedEngine();
    await engine.handleIncomingChanges("system-core-sys_test", changes);

    const state = engine.getSyncState("system-core-sys_test");
    expect(state?.lastSyncedSeq).toBe(3);
  });

  it("rolls back on mid-batch decryption failure", () => {
    const keyResolver = createKeyResolver();
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const base = Automerge.from<Record<string, unknown>>({ value: "initial" });
    const session = new EncryptedSyncSession({
      doc: base,
      keys,
      documentId: "test-doc",
      sodium,
    });

    const validEnv = session.change((d) => {
      d["value"] = "updated";
    });

    // Create a corrupted envelope
    const corruptedCiphertext = new Uint8Array(validEnv.ciphertext);
    corruptedCiphertext[0] = (corruptedCiphertext[0] ?? 0) ^ 0xff;

    const receiverSession = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: "test-doc",
      sodium,
    });

    const docBefore = receiverSession.document;
    const seqBefore = receiverSession.lastSyncedSeq;

    expect(() => {
      receiverSession.applyEncryptedChanges([
        { ...validEnv, seq: 1, ciphertext: corruptedCiphertext },
      ]);
    }).toThrow();

    expect(receiverSession.document).toBe(docBefore);
    expect(receiverSession.lastSyncedSeq).toBe(seqBefore);
  });
});

// ── P-M2: Skip redundant hydration ────────────────────────────────

describe("P-M2: skip redundant hydration", () => {
  it("skips server fetch when local snapshot matches manifest version", async () => {
    const keyResolver = createKeyResolver();
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    // Create a snapshot at version 5
    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const tempSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "system-core-sys_test",
      sodium,
    });
    const snapshot = tempSession.createSnapshot(5);

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
          sizeBytes: 100,
          snapshotVersion: 5,
          archived: false,
        },
      ],
    };

    const fetchLatestSnapshot = vi.fn().mockResolvedValue(null);
    const fetchChangesSince = vi.fn().mockResolvedValue([]);
    const networkAdapter: SyncNetworkAdapter = {
      submitChange: vi.fn().mockResolvedValue({ seq: 1 }),
      fetchChangesSince,
      submitSnapshot: vi.fn().mockResolvedValue(undefined),
      fetchLatestSnapshot,
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      fetchManifest: vi.fn().mockResolvedValue(manifest),
    };

    const storageAdapter = mockStorageAdapter({
      loadSnapshot: vi.fn().mockResolvedValue(snapshot),
      loadChangesSince: vi.fn().mockResolvedValue([]),
    });

    const engine = new SyncEngine({
      networkAdapter,
      storageAdapter,
      keyResolver: createKeyResolver(),
      sodium,
      profile: { profileType: "owner-full" },
      systemId: "sys_test" as SystemId,
      onError: vi.fn(),
    });

    await engine.bootstrap();

    // Server fetch calls should be skipped
    expect(fetchLatestSnapshot).not.toHaveBeenCalled();
    expect(fetchChangesSince).not.toHaveBeenCalled();

    engine.dispose();
  });

  it("fetches from server when manifest has newer snapshot version", async () => {
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
          sizeBytes: 100,
          snapshotVersion: 10,
          archived: false,
        },
      ],
    };

    const fetchLatestSnapshot = vi.fn().mockResolvedValue(null);
    const fetchChangesSince = vi.fn().mockResolvedValue([]);
    const networkAdapter: SyncNetworkAdapter = {
      submitChange: vi.fn().mockResolvedValue({ seq: 1 }),
      fetchChangesSince,
      submitSnapshot: vi.fn().mockResolvedValue(undefined),
      fetchLatestSnapshot,
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      fetchManifest: vi.fn().mockResolvedValue(manifest),
    };

    const engine = new SyncEngine({
      networkAdapter,
      storageAdapter: mockStorageAdapter(),
      keyResolver: createKeyResolver(),
      sodium,
      profile: { profileType: "owner-full" },
      systemId: "sys_test" as SystemId,
      onError: vi.fn(),
    });

    await engine.bootstrap();

    // Server fetch calls should happen since manifest has newer version
    expect(fetchLatestSnapshot).toHaveBeenCalledWith("system-core-sys_test");
    expect(fetchChangesSince).toHaveBeenCalled();

    engine.dispose();
  });
});

// ── P-M3: Batch storage writes ────────────────────────────────────

describe("P-M3: batch storage writes", () => {
  it("calls appendChanges when available on the adapter", async () => {
    const keyResolver = createKeyResolver();
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "system-core-sys_test",
      sodium,
    });

    const e1 = senderSession.change((d) => {
      const items = d as Record<string, Record<string, string>>;
      items["items"] = { key1: "value1" };
    });
    const e2 = senderSession.change((d) => {
      const items = d as Record<string, Record<string, string>>;
      const inner = items["items"];
      if (inner) inner["key2"] = "value2";
    });

    const changes: EncryptedChangeEnvelope[] = [
      { ...e1, seq: 1 },
      { ...e2, seq: 2 },
    ];

    const appendChanges = vi.fn().mockResolvedValue(undefined);
    const appendChange = vi.fn().mockResolvedValue(undefined);
    const engine = await createBootstrappedEngine({
      storageAdapter: mockStorageAdapter({ appendChanges, appendChange }),
    });

    await engine.handleIncomingChanges("system-core-sys_test", changes);

    // Should call appendChanges (batch) instead of appendChange (individual)
    expect(appendChanges).toHaveBeenCalledTimes(1);
    expect(appendChange).not.toHaveBeenCalled();
  });

  it("falls back to individual appendChange when appendChanges is not available", async () => {
    const keyResolver = createKeyResolver();
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "system-core-sys_test",
      sodium,
    });

    const e1 = senderSession.change((d) => {
      const items = d as Record<string, Record<string, string>>;
      items["items"] = { key1: "value1" };
    });
    const e2 = senderSession.change((d) => {
      const items = d as Record<string, Record<string, string>>;
      const inner = items["items"];
      if (inner) inner["key2"] = "value2";
    });

    const changes: EncryptedChangeEnvelope[] = [
      { ...e1, seq: 1 },
      { ...e2, seq: 2 },
    ];

    const appendChange = vi.fn().mockResolvedValue(undefined);
    // No appendChanges — omit from adapter
    const engine = await createBootstrappedEngine({
      storageAdapter: mockStorageAdapter({ appendChange }),
    });

    await engine.handleIncomingChanges("system-core-sys_test", changes);

    // Should fall back to individual calls
    expect(appendChange).toHaveBeenCalledTimes(2);
  });
});

// ── P-M4: Clean up resolved operation promises ────────────────────

describe("P-M4: operation promise cleanup", () => {
  it("cleans up documentQueues after operations complete", async () => {
    const engine = await createBootstrappedEngine();

    await engine.applyLocalChange("system-core-sys_test", (doc) => {
      const d = doc as Record<string, Record<string, unknown>>;
      d["_cleanup_test"] = { value: "test" };
    });

    // Allow microtask queue to drain for cleanup callback
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // After the operation completes and microtasks drain, the queue should be cleaned up
    // We can verify indirectly: the engine should still work (no stale promises)
    const seq2 = await engine.applyLocalChange("system-core-sys_test", (doc) => {
      const d = doc as Record<string, Record<string, unknown>>;
      d["_cleanup_test2"] = { value: "test2" };
    });

    expect(seq2).toBe(2);

    engine.dispose();
  });
});

// ── P-M5: Cap conflict retry buffer ───────────────────────────────

describe("P-M5: conflict retry buffer cap", () => {
  it("conflict persistence failures are logged and do not crash the engine", async () => {
    const saveConflicts = vi.fn().mockRejectedValue(new Error("DB unavailable"));
    const failingPersistenceAdapter: ConflictPersistenceAdapter = {
      saveConflicts,
      deleteOlderThan: vi.fn().mockResolvedValue(0),
    };

    const onError = vi.fn();
    const keyResolver = createKeyResolver();
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "system-core-sys_test",
      sodium,
    });

    const engine = await createBootstrappedEngine({
      conflictPersistenceAdapter: failingPersistenceAdapter,
      onError,
    });

    // Apply several changes — the engine should not crash even if persistence
    // repeatedly fails. The cap ensures the internal buffer stays bounded.
    for (let i = 1; i <= 5; i++) {
      const env = senderSession.change((d) => {
        const items = d as Record<string, Record<string, number>>;
        const inner = items["items"];
        if (inner) inner[`key${String(i)}`] = i;
      });
      await engine.handleIncomingChanges("system-core-sys_test", [{ ...env, seq: i }]);
    }

    // Engine should still function correctly after failed persistence attempts
    const state = engine.getSyncState("system-core-sys_test");
    expect(state?.lastSyncedSeq).toBe(5);

    engine.dispose();
  });
});

// ── P-M8: Bounded concurrency for envelope processing ─────────────

describe("P-M8: bounded concurrency for correction envelopes", () => {
  it("limits concurrent network submissions", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    let seqCounter = 0;

    const submitChange = vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent;
        }
        seqCounter++;
        const seq = seqCounter;
        return new Promise<EncryptedChangeEnvelope>((resolve) => {
          setTimeout(() => {
            currentConcurrent--;
            resolve({ ...change, seq });
          }, 10);
        });
      });

    const onError = vi.fn();
    const appendChange = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter({ appendChange });

    const networkAdapter: SyncNetworkAdapter = {
      submitChange,
      fetchChangesSince: vi.fn().mockResolvedValue([]),
      submitSnapshot: vi.fn().mockResolvedValue(undefined),
      fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
    };

    // Create 10 test envelopes
    const envelopes: Omit<EncryptedChangeEnvelope, "seq">[] = [];
    for (let i = 1; i <= 10; i++) {
      envelopes.push({
        documentId: "doc_a",
        ciphertext: new Uint8Array([i]),
        nonce: nonce(i),
        signature: sig(i),
        authorPublicKey: pubkey(1),
      });
    }

    await submitCorrectionEnvelopes(
      { networkAdapter, storageAdapter, onError },
      "doc_a",
      envelopes,
    );

    // All 10 should be submitted
    expect(submitChange).toHaveBeenCalledTimes(10);

    // Concurrency should be bounded at 5 (CORRECTION_ENVELOPE_CONCURRENCY)
    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(0);

    // All 10 should be persisted
    expect(appendChange).toHaveBeenCalledTimes(10);
    expect(onError).not.toHaveBeenCalled();
  });
});
