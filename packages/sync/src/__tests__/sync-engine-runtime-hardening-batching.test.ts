/**
 * SyncEngine runtime hardening: batching and hydration (P-M1, P-M2, P-M3).
 *
 * Covers batch Automerge change application, redundant hydration skip, and
 * batch storage writes.
 */
import * as Automerge from "@automerge/automerge";
import { toUnixMillis } from "@pluralscape/types";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SyncEngine } from "../engine/sync-engine.js";
import { EncryptedSyncSession } from "../sync-session.js";

import {
  createBootstrappedEngine,
  createKeyResolver,
  mockStorageAdapter,
  setupHardeningEnv,
  teardownHardeningEnv,
} from "./helpers/runtime-hardening-fixtures.js";
import { asSyncDocId, sysId } from "./test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  const env = await setupHardeningEnv();
  ({ sodium, masterKey, signingKeys, bucketKeyCache } = env);
});

afterAll(() => {
  teardownHardeningEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── P-M1: Batch Automerge change application ───────────────────────

describe("P-M1: batch Automerge change application", () => {
  it("applies multiple changes in a single batch", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ counter: 0 });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
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

    const engine = await createBootstrappedEngine(env);
    await engine.handleIncomingChanges(asSyncDocId("system-core-sys_test"), changes);

    const state = engine.getSyncState(asSyncDocId("system-core-sys_test"));
    expect(state?.lastSyncedSeq).toBe(3);
  });

  it("rolls back on mid-batch decryption failure", () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const base = Automerge.from<Record<string, unknown>>({ value: "initial" });
    const session = new EncryptedSyncSession({
      doc: base,
      keys,
      documentId: asSyncDocId("test-doc"),
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
      documentId: asSyncDocId("test-doc"),
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
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    // Create a snapshot at version 5
    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const tempSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
      sodium,
    });
    const snapshot = tempSession.createSnapshot(5);

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
          snapshotVersion: 5,
          lastSeq: 5,
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
      keyResolver: createKeyResolver(env),
      sodium,
      profile: { profileType: "owner-full" },
      systemId: sysId("sys_test"),
      onError: vi.fn(),
    });

    await engine.bootstrap();

    // Server fetch calls should be skipped
    expect(fetchLatestSnapshot).not.toHaveBeenCalled();
    expect(fetchChangesSince).not.toHaveBeenCalled();

    engine.dispose();
  });

  it("fetches from server when manifest has newer snapshot version", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
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
          snapshotVersion: 10,
          lastSeq: 10,
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
      keyResolver: createKeyResolver(env),
      sodium,
      profile: { profileType: "owner-full" },
      systemId: sysId("sys_test"),
      onError: vi.fn(),
    });

    await engine.bootstrap();

    // Server fetch calls should happen since manifest has newer version
    expect(fetchLatestSnapshot).toHaveBeenCalledWith("system-core-sys_test");
    expect(fetchChangesSince).toHaveBeenCalled();

    engine.dispose();
  });

  it("always fetches when manifest reports version 0 even with local data", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    // Create a local snapshot at version 5
    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const tempSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
      sodium,
    });
    const snapshot = tempSession.createSnapshot(5);

    // Manifest reports version 0 — server has never snapshotted
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
      keyResolver: createKeyResolver(env),
      sodium,
      profile: { profileType: "owner-full" },
      systemId: sysId("sys_test"),
      onError: vi.fn(),
    });

    await engine.bootstrap();

    // Version 0 means never skip — both fetches should happen
    expect(fetchLatestSnapshot).toHaveBeenCalledWith("system-core-sys_test");
    expect(fetchChangesSince).toHaveBeenCalled();

    engine.dispose();
  });
});

// ── P-M3: Batch storage writes ────────────────────────────────────

describe("P-M3: batch storage writes", () => {
  it("calls appendChanges when available on the adapter", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
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
    const engine = await createBootstrappedEngine(env, {
      storageAdapter: mockStorageAdapter({ appendChanges, appendChange }),
    });

    await engine.handleIncomingChanges(asSyncDocId("system-core-sys_test"), changes);

    // Should call appendChanges (batch) instead of appendChange (individual)
    expect(appendChanges).toHaveBeenCalledTimes(1);
    expect(appendChange).not.toHaveBeenCalled();
  });

  it("falls back to individual appendChange when appendChanges is not available", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
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
    const engine = await createBootstrappedEngine(env, {
      storageAdapter: mockStorageAdapter({ appendChange }),
    });

    await engine.handleIncomingChanges(asSyncDocId("system-core-sys_test"), changes);

    // Should fall back to individual calls
    expect(appendChange).toHaveBeenCalledTimes(2);
  });
});
