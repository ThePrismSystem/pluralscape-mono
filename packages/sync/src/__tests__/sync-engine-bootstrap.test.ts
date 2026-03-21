/**
 * SyncEngine bootstrap tests.
 *
 * Tests initial sync flow: manifest fetch, profile filtering, document
 * hydration from snapshots + changes, subscription setup.
 */
import { SODIUM_CONSTANTS } from "@pluralscape/crypto";
import { toUnixMillis } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { SyncEngine } from "../engine/sync-engine.js";

import { asSyncDocId, pubkey, sysId } from "./test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { DocumentKeyResolver } from "../document-key-resolver.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { DocumentKeys } from "../types.js";
import type { AeadKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

// ── Mock factories ──────────────────────────────────────────────────

/**
 * Minimal SodiumAdapter mock for bootstrap tests.
 * Only memzero is exercised during bootstrap — other methods throw
 * if called, which catches unexpected crypto calls.
 */
function mockSodium(): SodiumAdapter {
  const unimplemented = (): never => {
    throw new Error("SodiumAdapter method not expected during bootstrap");
  };
  return {
    init: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    constants: SODIUM_CONSTANTS,
    supportsSecureMemzero: false,
    aeadEncrypt: unimplemented,
    aeadDecrypt: unimplemented,
    aeadKeygen: unimplemented,
    boxKeypair: unimplemented,
    boxSeedKeypair: unimplemented,
    boxEasy: unimplemented,
    boxOpenEasy: unimplemented,
    signKeypair: unimplemented,
    signSeedKeypair: unimplemented,
    signDetached: unimplemented,
    signVerifyDetached: unimplemented,
    pwhash: unimplemented,
    pwhashStr: unimplemented,
    pwhashStrVerify: unimplemented,
    kdfDeriveFromKey: unimplemented,
    kdfKeygen: unimplemented,
    genericHash: unimplemented,
    randomBytes: unimplemented,
    memzero: vi.fn(),
  } satisfies SodiumAdapter;
}

function mockKeys(): DocumentKeys {
  // Two-step cast through intermediate variables (same pattern as test-crypto-helpers)
  const encKey: unknown = new Uint8Array(32).fill(0xaa);
  const secKey: unknown = new Uint8Array(64).fill(0xcc);
  return {
    encryptionKey: encKey as AeadKey,
    signingKeys: {
      publicKey: pubkey(0xbb),
      secretKey: secKey,
    } as SignKeypair,
  };
}

/** Minimal DocumentKeyResolver mock — only resolveKeys and dispose are used during bootstrap. */
function mockKeyResolver(keys: DocumentKeys): DocumentKeyResolver {
  const resolver: unknown = {
    resolveKeys: vi.fn().mockReturnValue(keys),
    dispose: vi.fn(),
  };
  return resolver as DocumentKeyResolver;
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

function mockNetworkAdapter(overrides: Partial<SyncNetworkAdapter> = {}): SyncNetworkAdapter {
  const emptyManifest: SyncManifest = { systemId: sysId("sys_test"), documents: [] };
  return {
    submitChange: vi.fn().mockResolvedValue({ seq: 1 }),
    fetchChangesSince: vi.fn().mockResolvedValue([]),
    submitSnapshot: vi.fn().mockResolvedValue(undefined),
    fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    fetchManifest: vi.fn().mockResolvedValue(emptyManifest),
    ...overrides,
  };
}

function createEngine(overrides: Partial<SyncEngineConfig> = {}): SyncEngine {
  const keys = mockKeys();
  return new SyncEngine({
    networkAdapter: mockNetworkAdapter(),
    storageAdapter: mockStorageAdapter(),
    keyResolver: mockKeyResolver(keys),
    sodium: mockSodium(),
    profile: { profileType: "owner-full" },
    systemId: sysId("sys_test"),
    onError: vi.fn(),
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("SyncEngine bootstrap", () => {
  it("completes bootstrap from empty server", async () => {
    const engine = createEngine();
    await engine.bootstrap();
    expect(engine.getActiveDocIds()).toHaveLength(0);
  });

  it("hydrates documents from manifest", async () => {
    const manifest: SyncManifest = {
      systemId: sysId("sys_test"),
      documents: [
        {
          docId: asSyncDocId("system-core-sys_test"),
          docType: "system-core",
          keyType: "derived",
          bucketId: null,
          channelId: null,
          timePeriod: null,
          createdAt: toUnixMillis(1000),
          updatedAt: toUnixMillis(1000),
          sizeBytes: 100,
          snapshotVersion: 0,
          lastSeq: 0,
          archived: false,
        },
      ],
    };

    const networkAdapter = mockNetworkAdapter({
      fetchManifest: vi.fn().mockResolvedValue(manifest),
    });

    const engine = createEngine({ networkAdapter });
    await engine.bootstrap();

    expect(engine.getActiveDocIds()).toContain("system-core-sys_test");
    expect(engine.getSession(asSyncDocId("system-core-sys_test"))).toBeDefined();
  });

  it("evicts stale local documents not in manifest", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter({
      listDocuments: vi.fn().mockResolvedValue(["stale-doc-sys_old"]),
      deleteDocument: deleteFn,
    });
    const networkAdapter = mockNetworkAdapter();

    const engine = createEngine({ networkAdapter, storageAdapter });
    await engine.bootstrap();

    expect(deleteFn).toHaveBeenCalledWith("stale-doc-sys_old");
  });

  it("logs error when eviction fails but continues bootstrap", async () => {
    const evictionError = new Error("Storage I/O error");
    const deleteFn = vi.fn().mockRejectedValue(evictionError);
    const storageAdapter = mockStorageAdapter({
      listDocuments: vi.fn().mockResolvedValue(["stale-doc-sys_fail"]),
      deleteDocument: deleteFn,
    });
    const networkAdapter = mockNetworkAdapter();
    const onError = vi.fn();

    const engine = createEngine({ networkAdapter, storageAdapter, onError });
    await engine.bootstrap();

    expect(deleteFn).toHaveBeenCalledWith("stale-doc-sys_fail");
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to evict document"),
      evictionError,
    );
  });

  it("subscribes to active documents for real-time updates", async () => {
    const subscribeFn = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
    const manifest: SyncManifest = {
      systemId: sysId("sys_test"),
      documents: [
        {
          docId: asSyncDocId("system-core-sys_test"),
          docType: "system-core",
          keyType: "derived",
          bucketId: null,
          channelId: null,
          timePeriod: null,
          createdAt: toUnixMillis(1000),
          updatedAt: toUnixMillis(1000),
          sizeBytes: 100,
          snapshotVersion: 0,
          lastSeq: 0,
          archived: false,
        },
      ],
    };

    const networkAdapter = mockNetworkAdapter({
      fetchManifest: vi.fn().mockResolvedValue(manifest),
      subscribe: subscribeFn,
    });

    const engine = createEngine({ networkAdapter });
    await engine.bootstrap();

    expect(subscribeFn).toHaveBeenCalledWith("system-core-sys_test", expect.any(Function));
  });

  it("fetches server changes during hydration", async () => {
    const fetchChangesSince = vi.fn().mockResolvedValue([]);
    const manifest: SyncManifest = {
      systemId: sysId("sys_test"),
      documents: [
        {
          docId: asSyncDocId("system-core-sys_test"),
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

    const networkAdapter = mockNetworkAdapter({
      fetchManifest: vi.fn().mockResolvedValue(manifest),
      fetchChangesSince,
    });

    const engine = createEngine({ networkAdapter });
    await engine.bootstrap();

    expect(fetchChangesSince).toHaveBeenCalledWith("system-core-sys_test", 0);
  });

  it("disposes cleanly by unsubscribing all", async () => {
    const unsubscribe = vi.fn();
    const manifest: SyncManifest = {
      systemId: sysId("sys_test"),
      documents: [
        {
          docId: asSyncDocId("system-core-sys_test"),
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

    const networkAdapter = mockNetworkAdapter({
      fetchManifest: vi.fn().mockResolvedValue(manifest),
      subscribe: vi.fn().mockReturnValue({ unsubscribe }),
    });

    const engine = createEngine({ networkAdapter });
    await engine.bootstrap();
    engine.dispose();

    expect(unsubscribe).toHaveBeenCalled();
    expect(engine.getActiveDocIds()).toHaveLength(0);
  });
});
