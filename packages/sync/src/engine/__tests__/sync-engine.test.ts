/**
 * SyncEngine branch-coverage tests.
 *
 * Targets uncovered branches in sync-engine.ts not covered by existing
 * test files: hydration edge cases, dispose close() variants,
 * replayOfflineQueue zero-replayed path, duplicate-change filtering,
 * and submitCorrectionEnvelopes persist-rejection path.
 */
import { SODIUM_CONSTANTS } from "@pluralscape/crypto";
import { toUnixMillis } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { asSyncDocId, nonce, pubkey, sig, sysId } from "../../__tests__/test-crypto-helpers.js";
import { submitCorrectionEnvelopes, SyncEngine } from "../sync-engine.js";

import type { SyncManifest, SyncNetworkAdapter } from "../../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../../adapters/storage-adapter.js";
import type { DocumentKeyResolver } from "../../document-key-resolver.js";
import type {
  DocumentKeys,
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
} from "../../types.js";
import type { SyncEngineConfig } from "../sync-engine.js";
import type { AeadKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

// ── Helpers ───────────────────────────────────────────────────────────

const SYSTEM_CORE_DOC_ID = asSyncDocId("system-core-sys_test");

function mockSodium(): SodiumAdapter {
  const unimplemented = (): never => {
    throw new Error("SodiumAdapter method not expected in these tests");
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

function manifestWithDoc(snapshotVersion = 0, lastSeq = 0): SyncManifest {
  return {
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
        snapshotVersion,
        lastSeq,
        archived: false,
      },
    ],
  };
}

function makeSnapshot(version: number): EncryptedSnapshotEnvelope {
  return {
    documentId: SYSTEM_CORE_DOC_ID,
    snapshotVersion: version,
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(version),
    signature: sig(3),
    authorPublicKey: pubkey(1),
  };
}

function makeChange(seq: number): EncryptedChangeEnvelope {
  return {
    documentId: SYSTEM_CORE_DOC_ID,
    seq,
    ciphertext: new Uint8Array([seq]),
    nonce: nonce(seq),
    signature: sig(seq),
    authorPublicKey: pubkey(1),
  };
}

function mockKeyResolver(): DocumentKeyResolver {
  const resolver: unknown = {
    resolveKeys: vi.fn().mockReturnValue(mockKeys()),
    dispose: vi.fn(),
  };
  return resolver as DocumentKeyResolver;
}

function createEngine(overrides: Partial<SyncEngineConfig> = {}): SyncEngine {
  return new SyncEngine({
    networkAdapter: mockNetworkAdapter(),
    storageAdapter: mockStorageAdapter(),
    keyResolver: mockKeyResolver(),
    sodium: mockSodium(),
    profile: { profileType: "owner-full" },
    systemId: sysId("sys_test"),
    onError: vi.fn(),
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SyncEngine branch coverage", () => {
  // ── replayOfflineQueue ─────────────────────────────────────────────

  describe("replayOfflineQueue", () => {
    it("skips session reload when replayed === 0", async () => {
      // drainUnsynced returns empty — replayed will be 0, no session reload
      const offlineQueueAdapter = {
        enqueue: vi.fn().mockResolvedValue("id1"),
        drainUnsynced: vi.fn().mockResolvedValue([]),
        markSynced: vi.fn().mockResolvedValue(undefined),
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const loadChangesSince = vi.fn().mockResolvedValue([]);
      const storageAdapter = mockStorageAdapter({ loadChangesSince });

      const engine = createEngine({ offlineQueueAdapter, storageAdapter });
      await engine.bootstrap();

      // replayOfflineQueue called (via bootstrap), replayed === 0 → no session reload
      // loadChangesSince is only called during hydration (0 calls, since manifest is empty)
      // reset and call replay manually to verify the replayed=0 branch
      loadChangesSince.mockClear();
      await engine.replayOfflineQueue();

      // loadChangesSince not called (no sessions, replayed=0)
      expect(loadChangesSince).not.toHaveBeenCalled();

      engine.dispose();
    });

    it("does not reload changes when replayed > 0 but loadChangesSince returns empty", async () => {
      // Bootstrap a document first so there is a session to reload
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 0)),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        fetchChangesSince: vi.fn().mockResolvedValue([]),
      });

      const loadChangesSince = vi.fn().mockResolvedValue([]);
      const storageAdapter = mockStorageAdapter({ loadChangesSince });

      const offlineQueueAdapter = {
        enqueue: vi.fn().mockResolvedValue("id1"),
        // First drain (bootstrap) returns 1 entry that succeeds, replayed > 0
        drainUnsynced: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "oq_1",
              documentId: SYSTEM_CORE_DOC_ID,
              envelope: makeChange(1),
              enqueuedAt: 1000,
              syncedAt: null,
              serverSeq: null,
            },
          ])
          // Second drain (manual call) returns empty
          .mockResolvedValueOnce([]),
        markSynced: vi.fn().mockResolvedValue(undefined),
        deleteConfirmed: vi.fn().mockResolvedValue(0),
      };

      const submitChange = vi
        .fn()
        .mockImplementation((_docId: string, env: Omit<EncryptedChangeEnvelope, "seq">) =>
          Promise.resolve({ ...env, seq: 5 }),
        );
      networkAdapter.submitChange = submitChange;

      const onError = vi.fn();
      const engine = createEngine({ networkAdapter, storageAdapter, offlineQueueAdapter, onError });
      await engine.bootstrap(); // replayed > 0 → session reload; loadChangesSince returns []

      // The if (changes.length > 0) branch inside the session reload should be false
      // Verify no errors emitted for this path
      expect(onError).not.toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        expect.anything(),
      );

      engine.dispose();
    });
  });

  // ── dispose() close() variants ─────────────────────────────────────

  describe("dispose() close() variants", () => {
    it("handles synchronous close() on network adapter (non-Promise return)", async () => {
      // Network close returns undefined (sync), not a Promise
      const networkClose = vi.fn().mockReturnValue(undefined);
      const networkAdapter = mockNetworkAdapter();
      networkAdapter.close = networkClose;

      const onError = vi.fn();
      const engine = createEngine({ networkAdapter, onError });
      await engine.bootstrap();

      engine.dispose();

      expect(networkClose).toHaveBeenCalledTimes(1);
      // No errors for sync close
      const closeErrors = (onError.mock.calls as unknown[][]).filter(
        (call) => typeof call[0] === "string" && call[0].includes("close"),
      );
      expect(closeErrors).toHaveLength(0);
    });

    it("handles async close() on storage adapter (Promise return)", async () => {
      // Storage close returns a resolving Promise
      const storageClose = vi.fn().mockResolvedValue(undefined);
      const storageAdapter = mockStorageAdapter();
      storageAdapter.close = storageClose;

      const onError = vi.fn();
      const engine = createEngine({ storageAdapter, onError });
      await engine.bootstrap();

      engine.dispose();

      expect(storageClose).toHaveBeenCalledTimes(1);

      // Wait for the async close to settle
      await vi.waitFor(() => {
        const closeErrors = (onError.mock.calls as unknown[][]).filter(
          (call) => typeof call[0] === "string" && call[0].includes("close"),
        );
        // No errors expected — Promise resolved successfully
        expect(closeErrors).toHaveLength(0);
      });
    });

    it("catches async rejection from storage adapter close() and reports via onError", async () => {
      const closeError = new Error("Storage async close failed");
      const storageClose = vi.fn().mockRejectedValue(closeError);
      const storageAdapter = mockStorageAdapter();
      storageAdapter.close = storageClose;

      const onError = vi.fn();
      const engine = createEngine({ storageAdapter, onError });
      await engine.bootstrap();

      engine.dispose();

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          "Failed to close storage adapter during dispose",
          closeError,
        );
      });
    });

    it("handles synchronous throwing close() on storage adapter", async () => {
      const storageClose = vi.fn().mockImplementation(() => {
        throw new Error("Storage sync close threw");
      });
      const storageAdapter = mockStorageAdapter();
      storageAdapter.close = storageClose;

      const onError = vi.fn();
      const engine = createEngine({ storageAdapter, onError });
      await engine.bootstrap();

      // Should not throw
      engine.dispose();

      expect(onError).toHaveBeenCalledWith(
        "Failed to close storage adapter during dispose",
        expect.any(Error),
      );
    });
  });

  // ── applyIncomingChanges duplicate-seq filter ──────────────────────

  describe("applyIncomingChanges — duplicate changes", () => {
    it("returns early when all incoming changes are already applied", async () => {
      // Bootstrap with a document that has lastSyncedSeq = 0
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 0)),
      });

      const appendChange = vi.fn().mockResolvedValue(undefined);
      const storageAdapter = mockStorageAdapter({ appendChange });

      const engine = createEngine({ networkAdapter, storageAdapter });
      await engine.bootstrap();

      appendChange.mockClear();

      // Send a change with seq = 0, which is NOT > currentSeq (0), so newChanges is empty
      await engine.handleIncomingChanges(SYSTEM_CORE_DOC_ID, [makeChange(0)]);

      // No persistence should happen — early return triggered
      expect(appendChange).not.toHaveBeenCalled();

      engine.dispose();
    });
  });

  // ── hydrateDocument edge cases ─────────────────────────────────────

  describe("hydrateDocument — no local changes", () => {
    it("skips local-changes block when storage returns empty array", async () => {
      // localChanges = [] → localChanges.length > 0 is false → ternary false branch
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 0)),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        fetchChangesSince: vi.fn().mockResolvedValue([]),
      });

      const storageAdapter = mockStorageAdapter({
        loadChangesSince: vi.fn().mockResolvedValue([]),
      });

      const engine = createEngine({ networkAdapter, storageAdapter });
      await engine.bootstrap();

      // Engine bootstrapped without error — session exists
      expect(engine.getActiveDocIds()).toContain(SYSTEM_CORE_DOC_ID);
      engine.dispose();
    });

    it("skips changesAfterSnapshot block when all local changes are before snapshot seq", async () => {
      // localChanges has one entry with seq=2; localSnapshotSeq=0, so localMaxSeq=2
      // serverLastSeq=0 → changesUpToDate = (0 > 0 && ...) = false → fetchChangesSince called
      // But this test is about the changesAfterSnapshot filter: local seq=2 < session.lastSyncedSeq
      // when session has no snapshot (created empty), lastSyncedSeq=0, so seq=2 > 0 → included.
      // Use a change with seq=0 so it's filtered out as changesAfterSnapshot is empty.
      const localChange = makeChange(0); // seq=0 is NOT > lastSyncedSeq(0)

      const fetchChangesSince = vi.fn().mockResolvedValue([]);
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 0)),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        fetchChangesSince,
      });

      const onError = vi.fn();
      const storageAdapter = mockStorageAdapter({
        loadSnapshot: vi.fn().mockResolvedValue(null),
        loadChangesSince: vi.fn().mockResolvedValue([localChange]),
      });

      const engine = createEngine({ networkAdapter, storageAdapter, onError });
      await engine.bootstrap();

      // Session should exist — empty doc created successfully
      expect(engine.getActiveDocIds()).toContain(SYSTEM_CORE_DOC_ID);
      engine.dispose();
    });
  });

  describe("hydrateDocument — snapshot up-to-date", () => {
    it("skips fetchLatestSnapshot when local snapshot version >= server version", async () => {
      // serverSnapshotVer=3, localSnapshotSeq=3 → snapshotUpToDate=true → no network fetch
      const { from, save } = await import("@automerge/automerge");
      const emptyDoc = from<Record<string, unknown>>({});
      const emptyBinary = save(emptyDoc);

      const localSnapshot = makeSnapshot(3);

      const sodium: SodiumAdapter = {
        ...mockSodium(),
        aeadDecrypt: vi.fn().mockReturnValue(emptyBinary),
        signVerifyDetached: vi.fn().mockReturnValue(true),
      };

      const fetchLatestSnapshot = vi.fn().mockResolvedValue(null);
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(3, 0)),
        fetchLatestSnapshot,
        fetchChangesSince: vi.fn().mockResolvedValue([]),
      });

      const storageAdapter = mockStorageAdapter({
        loadSnapshot: vi.fn().mockResolvedValue(localSnapshot),
        loadChangesSince: vi.fn().mockResolvedValue([]),
      });

      const engine = createEngine({ networkAdapter, storageAdapter, sodium });
      await engine.bootstrap();

      // fetchLatestSnapshot should NOT have been called
      expect(fetchLatestSnapshot).not.toHaveBeenCalled();

      expect(engine.getActiveDocIds()).toContain(SYSTEM_CORE_DOC_ID);
      engine.dispose();
    });
  });

  describe("hydrateDocument — changes up-to-date", () => {
    it("skips fetchChangesSince when local max seq >= server last seq", async () => {
      // serverLastSeq=5, localChange.seq=5 → changesUpToDate=true → skip fetch
      const localChange = makeChange(5);

      const fetchChangesSince = vi.fn().mockResolvedValue([]);
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 5)),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        fetchChangesSince,
      });

      const storageAdapter = mockStorageAdapter({
        loadSnapshot: vi.fn().mockResolvedValue(null),
        loadChangesSince: vi.fn().mockResolvedValue([localChange]),
      });

      const engine = createEngine({ networkAdapter, storageAdapter });
      await engine.bootstrap();

      // fetchChangesSince should NOT have been called — the changesUpToDate
      // branch is what we are exercising; session activation is gated on
      // sodium decryption succeeding, which is intentionally stubbed here.
      expect(fetchChangesSince).not.toHaveBeenCalled();

      engine.dispose();
    });
  });

  describe("hydrateDocument — server changes empty", () => {
    it("skips applyEncryptedChanges when server returns no changes", async () => {
      // fetchChangesSince returns [] → changes.length > 0 is false
      const networkAdapter = mockNetworkAdapter({
        fetchManifest: vi.fn().mockResolvedValue(manifestWithDoc(0, 0)),
        fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
        fetchChangesSince: vi.fn().mockResolvedValue([]),
      });

      const appendChange = vi.fn().mockResolvedValue(undefined);
      const storageAdapter = mockStorageAdapter({ appendChange });

      const engine = createEngine({ networkAdapter, storageAdapter });
      await engine.bootstrap();

      // No changes persisted during hydration
      expect(appendChange).not.toHaveBeenCalled();
      expect(engine.getActiveDocIds()).toContain(SYSTEM_CORE_DOC_ID);
      engine.dispose();
    });
  });

  // ── submitCorrectionEnvelopes — persist rejection ──────────────────

  describe("submitCorrectionEnvelopes — persist failure", () => {
    it("logs error when appendChange rejects for a successfully submitted envelope", async () => {
      const envelope: Omit<EncryptedChangeEnvelope, "seq"> = {
        documentId: asSyncDocId("doc_test"),
        ciphertext: new Uint8Array([1]),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
      };

      const onError = vi.fn();
      const submitChange = vi.fn().mockResolvedValue({ ...envelope, seq: 1 });
      const appendChange = vi.fn().mockRejectedValue(new Error("Disk full"));

      await submitCorrectionEnvelopes(
        {
          networkAdapter: mockNetworkAdapter({ submitChange }),
          storageAdapter: mockStorageAdapter({ appendChange }),
          onError,
        },
        asSyncDocId("doc_test"),
        [envelope],
      );

      expect(submitChange).toHaveBeenCalledTimes(1);
      expect(appendChange).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        "Failed to persist correction envelope for doc_test",
        expect.any(Error),
      );
    });

    it("logs error when all envelopes fail to submit (none fulfilled)", async () => {
      const envelope: Omit<EncryptedChangeEnvelope, "seq"> = {
        documentId: asSyncDocId("doc_test"),
        ciphertext: new Uint8Array([1]),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
      };

      const onError = vi.fn();
      const submitChange = vi.fn().mockRejectedValue(new Error("Network down"));
      const appendChange = vi.fn();

      await submitCorrectionEnvelopes(
        {
          networkAdapter: mockNetworkAdapter({ submitChange }),
          storageAdapter: mockStorageAdapter({ appendChange }),
          onError,
        },
        asSyncDocId("doc_test"),
        [envelope],
      );

      expect(submitChange).toHaveBeenCalledTimes(1);
      // No envelopes in sequenced → appendChange never called
      expect(appendChange).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        "Failed to submit correction envelope for doc_test",
        expect.any(Error),
      );
    });
  });
});
