/**
 * SyncEngine bootstrap tests.
 *
 * Tests initial sync flow: manifest fetch, profile filtering, document
 * hydration from snapshots + changes, subscription setup.
 */
import { describe, expect, it, vi } from "vitest";

import { SyncEngine } from "../engine/sync-engine.js";

import { pubkey } from "./test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { DocumentKeyResolver } from "../document-key-resolver.js";
import type { SyncEngineConfig } from "../engine/sync-engine.js";
import type { DocumentKeys } from "../types.js";
import type { AeadKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { SystemId, UnixMillis } from "@pluralscape/types";

// ── Mock factories ──────────────────────────────────────────────────

function mockSodium(): SodiumAdapter {
  return {
    memzero: vi.fn(),
  } as never;
}

function mockKeys(): DocumentKeys {
  return {
    encryptionKey: new Uint8Array(32).fill(0xaa) as never as AeadKey,
    signingKeys: {
      publicKey: pubkey(0xbb),
      privateKey: new Uint8Array(64).fill(0xcc),
    } as never as SignKeypair,
  };
}

function mockKeyResolver(keys: DocumentKeys): DocumentKeyResolver {
  return {
    resolveKeys: vi.fn().mockReturnValue(keys),
    dispose: vi.fn(),
  } as never;
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
  const emptyManifest: SyncManifest = { systemId: "sys_test" as SystemId, documents: [] };
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
    systemId: "sys_test" as SystemId,
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
          snapshotVersion: 0,
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
    expect(engine.getSession("system-core-sys_test")).toBeDefined();
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

  it("subscribes to active documents for real-time updates", async () => {
    const subscribeFn = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
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
          snapshotVersion: 0,
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
