/**
 * Compaction handler tests.
 *
 * Uses real sodium for snapshot encryption roundtrips.
 */
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
import { compactionIdempotencyKey, handleCompaction } from "../engine/compaction-handler.js";
import { createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";
import { DEFAULT_COMPACTION_CONFIG, DEFAULT_STORAGE_BUDGET } from "../types.js";

import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { CompactionInput } from "../engine/compaction-handler.js";
import type { SyncRelayService } from "../relay-service.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

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
  masterKey = await deriveMasterKey("compaction-test-password", salt, "mobile");
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  bucketKeyCache.clearAll();
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

function createKeyResolver(): DocumentKeyResolver {
  return DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
}

function createSession(): EncryptedSyncSession<unknown> {
  const resolver = createKeyResolver();
  const keys = resolver.resolveKeys("system-core-sys_test");
  return new EncryptedSyncSession({
    doc: createSystemCoreDocument(),
    keys,
    documentId: "system-core-sys_test",
    sodium,
  });
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

// ── Tests ─────────────────────────────────────────────────────────────

describe("handleCompaction", () => {
  it("compacts when change threshold is met", async () => {
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const saveSnapshot = vi.fn().mockResolvedValue(undefined);
    const pruneChanges = vi.fn().mockResolvedValue(undefined);
    const storage = mockStorageAdapter();
    storage.saveSnapshot = saveSnapshot;
    storage.pruneChangesBeforeSnapshot = pruneChanges;

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: DEFAULT_COMPACTION_CONFIG.changeThreshold,
      lastSyncedSeq: 200,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
    };

    const result = await handleCompaction(input, relayService, storage);

    expect(result.compacted).toBe(true);
    if (!result.compacted) throw new Error("expected compacted");
    expect(result.reason).toBe("change-threshold");
    expect(result.newSnapshotVersion).toBe(1);
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(pruneChanges).toHaveBeenCalledWith("system-core-sys_test", 200);
  });

  it("compacts when size threshold is met", async () => {
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const storage = mockStorageAdapter();

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: 5,
      lastSyncedSeq: 0,
      currentSizeBytes: DEFAULT_COMPACTION_CONFIG.sizeThresholdBytes,
      currentSnapshotVersion: 2,
    };

    const result = await handleCompaction(input, relayService, storage);

    expect(result.compacted).toBe(true);
    if (!result.compacted) throw new Error("expected compacted");
    expect(result.reason).toBe("size-threshold");
    expect(result.newSnapshotVersion).toBe(3);
  });

  it("skips when below threshold", async () => {
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const storage = mockStorageAdapter();

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: 5,
      lastSyncedSeq: 0,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
    };

    const saveSnapshot = vi.fn();
    const pruneChanges = vi.fn();
    storage.saveSnapshot = saveSnapshot;
    storage.pruneChangesBeforeSnapshot = pruneChanges;

    const result = await handleCompaction(input, relayService, storage);

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("not-eligible");
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(pruneChanges).not.toHaveBeenCalled();
  });

  it("blocks when storage budget exceeded", async () => {
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const storage = mockStorageAdapter();

    const allDocumentSizes = new Map<string, number>();
    allDocumentSizes.set("system-core-sys_test", DEFAULT_STORAGE_BUDGET.maxTotalBytes + 1);

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: DEFAULT_COMPACTION_CONFIG.changeThreshold,
      lastSyncedSeq: 0,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
      budget: DEFAULT_STORAGE_BUDGET,
      allDocumentSizes,
    };

    const result = await handleCompaction(input, relayService, storage);

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("storage-budget-exceeded");
  });

  it("submits snapshot to relay service", async () => {
    const session = createSession();
    const submitSnapshot = vi.fn().mockResolvedValue(undefined);
    const relayService: SyncRelayService = {
      submit: vi.fn().mockResolvedValue(1),
      getEnvelopesSince: vi.fn().mockResolvedValue([]),
      submitSnapshot,
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      getManifest: vi.fn().mockResolvedValue({ systemId: "", documents: [] }),
    };
    const storage = mockStorageAdapter();

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: DEFAULT_COMPACTION_CONFIG.changeThreshold,
      lastSyncedSeq: 0,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
    };

    await handleCompaction(input, relayService, storage);

    expect(submitSnapshot).toHaveBeenCalledTimes(1);
    const envelope = submitSnapshot.mock.calls[0]?.[0];
    expect(envelope.snapshotVersion).toBe(1);
    expect(envelope.documentId).toBe("system-core-sys_test");
  });

  it("returns localSaveFailed when local storage throws after relay succeeds", async () => {
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const storage = mockStorageAdapter();
    storage.saveSnapshot = vi.fn().mockRejectedValue(new Error("disk full"));

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: DEFAULT_COMPACTION_CONFIG.changeThreshold,
      lastSyncedSeq: 200,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
    };

    const result = await handleCompaction(input, relayService, storage);

    expect(result.compacted).toBe(true);
    if (!result.compacted) throw new Error("expected compacted");
    expect(result.localSaveFailed).toBe(true);
    expect(result.newSnapshotVersion).toBe(1);
  });

  it("logs warning when local save/prune fails", async () => {
    const warnFn = vi.fn();
    const session = createSession();
    const relay = new EncryptedRelay();
    const relayService = relay.asService();
    const storage = mockStorageAdapter();
    storage.saveSnapshot = vi.fn().mockRejectedValue(new Error("disk full"));

    const input: CompactionInput = {
      documentId: "system-core-sys_test",
      session,
      changesSinceSnapshot: DEFAULT_COMPACTION_CONFIG.changeThreshold,
      lastSyncedSeq: 0,
      currentSizeBytes: 100,
      currentSnapshotVersion: 0,
    };

    await handleCompaction(input, relayService, storage, { warn: warnFn });

    expect(warnFn).toHaveBeenCalledWith(
      "CompactionHandler: local save/prune failed",
      expect.objectContaining({ documentId: "system-core-sys_test" }),
    );
  });
});

describe("compactionIdempotencyKey", () => {
  it("produces deterministic keys", () => {
    const key = compactionIdempotencyKey("system-core-sys_abc", 3);
    expect(key).toBe("sync-compaction:system-core-sys_abc:3");
  });

  it("changes with version", () => {
    const k1 = compactionIdempotencyKey("doc-sys_1", 1);
    const k2 = compactionIdempotencyKey("doc-sys_1", 2);
    expect(k1).not.toBe(k2);
  });
});
