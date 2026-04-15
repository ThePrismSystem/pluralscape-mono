/**
 * SyncEngine event bus integration tests.
 *
 * Verifies that the engine emits the correct events to the event bus
 * after merges, snapshots, and errors — while keeping existing
 * onError/onConflict callbacks functional.
 */
import { SODIUM_CONSTANTS } from "@pluralscape/crypto";
import { toUnixMillis } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../../event-bus/event-bus.js";
import { SyncEngine } from "../sync-engine.js";

import type { SyncManifest, SyncNetworkAdapter } from "../../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../../adapters/storage-adapter.js";
import type { DocumentKeyResolver } from "../../document-key-resolver.js";
import type { DataLayerEventMap } from "../../event-bus/event-map.js";
import type { DocumentKeys, EncryptedSnapshotEnvelope } from "../../types.js";
import type { SyncEngineConfig } from "../sync-engine.js";
import type { AeadKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Test constants ────────────────────────────────────────────────────

function asSyncDocId(id: string): SyncDocumentId {
  return id as SyncDocumentId;
}

function sysId(id: string): SystemId {
  return id as SystemId;
}

const SYSTEM_CORE_DOC_ID = asSyncDocId("system-core-sys_test");

// ── Mock factories ──────────────────────────────────────────────────

function mockSodium(): SodiumAdapter {
  const unimplemented = (): never => {
    throw new Error("SodiumAdapter method not expected in event bus tests");
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
  const encKey: unknown = new Uint8Array(32).fill(0xaa);
  const secKey: unknown = new Uint8Array(64).fill(0xcc);
  const pubKey: unknown = new Uint8Array(32).fill(0xbb);
  return {
    encryptionKey: encKey as AeadKey,
    signingKeys: {
      publicKey: pubKey,
      secretKey: secKey,
    } as SignKeypair,
  };
}

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
      createdAt: toUnixMillis(1_000),
      updatedAt: toUnixMillis(1_000),
      sizeBytes: 0,
      snapshotVersion: 0,
      lastSeq: 0,
      archived: false,
    },
  ],
};

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

describe("SyncEngine event bus integration", () => {
  describe("sync:snapshot-applied", () => {
    it("emits when a snapshot is applied during hydration", async () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const listener = vi.fn();
      eventBus.on("sync:snapshot-applied", listener);

      const nonce: unknown = new Uint8Array(24).fill(1);
      const sig: unknown = new Uint8Array(64).fill(2);
      const pubKey: unknown = new Uint8Array(32).fill(3);
      const snapshot: EncryptedSnapshotEnvelope = {
        documentId: SYSTEM_CORE_DOC_ID,
        snapshotVersion: 5,
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: nonce as EncryptedSnapshotEnvelope["nonce"],
        signature: sig as EncryptedSnapshotEnvelope["signature"],
        authorPublicKey: pubKey as EncryptedSnapshotEnvelope["authorPublicKey"],
      };

      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue({
          systemId: sysId("sys_test"),
          documents: [
            {
              docId: SYSTEM_CORE_DOC_ID,
              docType: "system-core",
              keyType: "derived",
              bucketId: null,
              channelId: null,
              timePeriod: null,
              createdAt: toUnixMillis(1_000),
              updatedAt: toUnixMillis(1_000),
              sizeBytes: 100,
              snapshotVersion: 5,
              lastSeq: 0,
              archived: false,
            },
          ],
        }),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
      });

      // Use a sodium mock that supports fromSnapshot (aeadDecrypt needed)
      // fromSnapshot calls aeadDecrypt to decrypt the snapshot — mock it to return
      // a valid Automerge binary (empty doc)
      const { from, save } = await import("@automerge/automerge");
      const emptyDoc = from<Record<string, unknown>>({});
      const emptyBinary = save(emptyDoc);
      const sodium: SodiumAdapter = {
        ...mockSodium(),
        aeadDecrypt: vi.fn().mockReturnValue(emptyBinary),
        signVerifyDetached: vi.fn().mockReturnValue(true),
      };

      const engine = createEngine({
        networkAdapter,
        sodium,
        eventBus,
      });

      await engine.bootstrap();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        type: "sync:snapshot-applied",
        documentId: SYSTEM_CORE_DOC_ID,
        documentType: "system-core",
      });
    });
  });

  describe("sync:error", () => {
    it("emits when an error occurs during bootstrap", async () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const listener = vi.fn();
      eventBus.on("sync:error", listener);

      const onError = vi.fn();

      const storageAdapter = mockStorageAdapter({
        listDocuments: vi.fn().mockResolvedValue(["stale-doc-sys_old"]),
        deleteDocument: vi.fn().mockRejectedValue(new Error("eviction failed")),
      });

      const engine = createEngine({
        storageAdapter,
        onError,
        eventBus,
      });

      await engine.bootstrap();

      // onError callback should still be called
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to evict"),
        expect.any(Error),
      );

      // Event bus should also receive the error
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync:error",
          message: expect.stringContaining("Failed to evict"),
        }),
      );
    });

    it("emits when hydration fails", async () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const listener = vi.fn();
      eventBus.on("sync:error", listener);

      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
        fetchLatestSnapshot: vi.fn().mockRejectedValue(new Error("network down")),
      });

      const engine = createEngine({
        networkAdapter,
        eventBus,
      });

      await engine.bootstrap();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync:error",
          message: expect.stringContaining("Failed to hydrate"),
        }),
      );
    });
  });

  describe("backward compatibility", () => {
    it("does not throw when eventBus is not provided", async () => {
      const onError = vi.fn();

      const storageAdapter = mockStorageAdapter({
        listDocuments: vi.fn().mockResolvedValue(["stale-doc-sys_old"]),
        deleteDocument: vi.fn().mockRejectedValue(new Error("eviction failed")),
      });

      const engine = createEngine({
        storageAdapter,
        onError,
        // No eventBus
      });

      // Should not throw
      await engine.bootstrap();

      // Original callback still works
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to evict"),
        expect.any(Error),
      );
    });

    it("continues calling onError alongside eventBus emit", async () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const busListener = vi.fn();
      eventBus.on("sync:error", busListener);

      const onError = vi.fn();

      const storageAdapter = mockStorageAdapter({
        listDocuments: vi.fn().mockResolvedValue(["stale-doc-sys_old"]),
        deleteDocument: vi.fn().mockRejectedValue(new Error("eviction failed")),
      });

      const engine = createEngine({
        storageAdapter,
        onError,
        eventBus,
      });

      await engine.bootstrap();

      // Both should be called
      expect(onError).toHaveBeenCalled();
      expect(busListener).toHaveBeenCalled();
    });
  });

  describe("sync:changes-merged", () => {
    it("emits after applying incoming changes", async () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const listener = vi.fn();
      eventBus.on("sync:changes-merged", listener);

      // Use real crypto to produce valid encrypted changes
      const {
        configureSodium,
        createBucketKeyCache,
        generateIdentityKeypair,
        generateMasterKey,
        initSodium,
      } = await import("@pluralscape/crypto");
      const { WasmSodiumAdapter } = await import("@pluralscape/crypto/wasm");
      const Automerge = await import("@automerge/automerge");
      const { DocumentKeyResolver } = await import("../../document-key-resolver.js");
      const { EncryptedSyncSession } = await import("../../sync-session.js");
      const { EncryptedRelay } = await import("../../relay.js");

      const sodium = new WasmSodiumAdapter();
      configureSodium(sodium);
      await initSodium();

      const masterKey = generateMasterKey();
      const identity = generateIdentityKeypair(masterKey);
      const bucketKeyCache = createBucketKeyCache();

      const keyResolver = DocumentKeyResolver.create({
        masterKey,
        signingKeys: identity.signing,
        bucketKeyCache,
        sodium,
      });
      const keys = keyResolver.resolveKeys(SYSTEM_CORE_DOC_ID);

      // Create a sender session to produce valid encrypted changes
      const doc = Automerge.from<Record<string, unknown>>({ items: {} });
      const senderSession = new EncryptedSyncSession({
        doc,
        keys,
        documentId: SYSTEM_CORE_DOC_ID,
        sodium,
      });

      const envelope = senderSession.change((d) => {
        (d["items"] as Record<string, string>)["key1"] = "value1";
      });

      const change = { ...envelope, seq: 10 };

      const relay = new EncryptedRelay();
      const networkAdapter: SyncNetworkAdapter = {
        submitChange: vi
          .fn()
          .mockImplementation(
            async (_docId: string, c: Omit<typeof change, "seq">) =>
              ({ ...c, seq: await relay.submit(c) }) as typeof change,
          ),
        fetchChangesSince: vi.fn().mockResolvedValue([]),
        submitSnapshot: vi.fn().mockResolvedValue(undefined),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
      };

      const engine = new SyncEngine({
        networkAdapter,
        storageAdapter: mockStorageAdapter(),
        keyResolver,
        sodium,
        profile: { profileType: "owner-full" },
        systemId: sysId("sys_test"),
        onError: vi.fn(),
        eventBus,
      });

      await engine.bootstrap();
      await engine.handleIncomingChanges(SYSTEM_CORE_DOC_ID, [change]);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync:changes-merged",
          documentId: SYSTEM_CORE_DOC_ID,
          documentType: "system-core",
          conflicts: expect.any(Array) as unknown[],
        }),
      );

      // Cleanup
      bucketKeyCache.clearAll();
      sodium.memzero(identity.signing.secretKey);
      sodium.memzero(masterKey);
    });
  });
});
