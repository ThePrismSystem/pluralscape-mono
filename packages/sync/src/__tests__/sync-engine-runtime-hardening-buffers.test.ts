/**
 * SyncEngine runtime hardening: promise cleanup, conflict buffer cap,
 * and bounded concurrency for envelope processing (P-M4, P-M5, P-M8).
 */
import * as Automerge from "@automerge/automerge";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { submitCorrectionEnvelopes } from "../engine/sync-engine.js";
import * as PostMergeValidatorModule from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import {
  createBootstrappedEngine,
  createKeyResolver,
  mockStorageAdapter,
  setupHardeningEnv,
  SYSTEM_CORE_MANIFEST,
  teardownHardeningEnv,
} from "./helpers/runtime-hardening-fixtures.js";
import { asSyncDocId, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
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

// ── P-M4: Clean up resolved operation promises ────────────────────

describe("P-M4: operation promise cleanup", () => {
  it("cleans up documentQueues after operations complete", async () => {
    vi.useFakeTimers();
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const engine = await createBootstrappedEngine(env);

    await engine.applyLocalChange(asSyncDocId("system-core-sys_test"), "system-core", (doc) => {
      doc.system.name = new Automerge.ImmutableString("cleanup-test");
    });

    // Drain the microtask queue so the cleanup .then() handler fires
    await vi.advanceTimersByTimeAsync(0);

    // After the operation completes and microtasks drain, the queue entry should be removed
    expect(engine.pendingOperationCount).toBe(0);

    // Engine should still work with the cleaned-up queue
    const seq2 = await engine.applyLocalChange(
      asSyncDocId("system-core-sys_test"),
      "system-core",
      (doc) => {
        doc.system.name = new Automerge.ImmutableString("cleanup-test2");
      },
    );

    expect(seq2).toBe(2);

    engine.dispose();
    vi.useRealTimers();
  });
});

// ── P-M5: Cap conflict retry buffer ───────────────────────────────

describe("P-M5: conflict retry buffer cap", () => {
  it("conflict persistence failures are logged and do not crash the engine", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const saveConflicts = vi.fn().mockRejectedValue(new Error("DB unavailable"));
    const failingPersistenceAdapter: ConflictPersistenceAdapter = {
      saveConflicts,
      deleteOlderThan: vi.fn().mockResolvedValue(0),
    };

    const onError = vi.fn();
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
      sodium,
    });

    const engine = await createBootstrappedEngine(env, {
      conflictPersistenceAdapter: failingPersistenceAdapter,
      onError,
    });

    // Apply several changes — the engine should not crash even if persistence
    // repeatedly fails. The cap ensures the internal buffer stays bounded.
    for (let i = 1; i <= 5; i++) {
      const envelope = senderSession.change((d) => {
        const items = d as Record<string, Record<string, number>>;
        const inner = items["items"];
        if (inner) inner[`key${String(i)}`] = i;
      });
      await engine.handleIncomingChanges(asSyncDocId("system-core-sys_test"), [
        { ...envelope, seq: i },
      ]);
    }

    // Engine should still function correctly after failed persistence attempts
    const state = engine.getSyncState(asSyncDocId("system-core-sys_test"));
    expect(state?.lastSyncedSeq).toBe(5);

    engine.dispose();
  });

  it("drops oldest entries when buffer exceeds the configured cap", async () => {
    const env = { sodium, masterKey, signingKeys, bucketKeyCache };
    const saveConflicts = vi.fn().mockRejectedValue(new Error("DB unavailable"));
    const onError = vi.fn();
    const keyResolver = createKeyResolver(env);
    const keys = keyResolver.resolveKeys("system-core-sys_test");

    const doc = Automerge.from<Record<string, unknown>>({ items: {} });
    const senderSession = new EncryptedSyncSession({
      doc,
      keys,
      documentId: asSyncDocId("system-core-sys_test"),
      sodium,
    });

    // Inject fake conflict notifications so persistConflicts accumulates entries
    const fakeNotification: ConflictNotification = {
      entityType: "test",
      entityId: "test-1",
      fieldName: "value",
      resolution: "lww-field",
      detectedAt: Date.now(),
      summary: "test conflict",
    };
    vi.spyOn(PostMergeValidatorModule, "runAllValidations").mockReturnValue({
      cycleBreaks: [],
      sortOrderPatches: [],
      checkInNormalizations: 0,
      friendConnectionNormalizations: 0,
      frontingSessionNormalizations: 0,
      frontingCommentAuthorIssues: 0,
      timerConfigNormalizations: 0,
      webhookConfigIssues: 0,
      bucketContentTagDrops: 0,
      correctionEnvelopes: [],
      notifications: [fakeNotification],
      errors: [],
    });

    const engine = await createBootstrappedEngine(env, {
      conflictPersistenceAdapter: { saveConflicts, deleteOlderThan: vi.fn().mockResolvedValue(0) },
      onError,
      maxConflictRetryBatches: 3,
    });

    // Each handleIncomingChanges triggers persistConflicts with 1 fake notification.
    // With a failing adapter, each call accumulates 1 net entry in the buffer.
    // After 4 calls, buffer has 4 entries; cap of 3 triggers and drops 1 oldest.
    for (let i = 1; i <= 4; i++) {
      const envelope = senderSession.change((d) => {
        const items = d as Record<string, Record<string, number>>;
        const inner = items["items"];
        if (inner) inner[`cap_key${String(i)}`] = i;
      });
      await engine.handleIncomingChanges(asSyncDocId("system-core-sys_test"), [
        { ...envelope, seq: i },
      ]);
    }

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("dropped 1 oldest entries"), null);

    // Engine still functions
    const state = engine.getSyncState(asSyncDocId("system-core-sys_test"));
    expect(state?.lastSyncedSeq).toBe(4);

    engine.dispose();
  });
});

// P-M6 (dedup key optimization) is covered by relay-hardening tests.
// P-M7 (removed broken targeted scan) is verified by the absence of
// extractModifiedEntityTypes and its tests — no regression test needed.

// ── P-M8: Bounded concurrency for envelope processing ─────────────

describe("P-M8: bounded concurrency for correction envelopes", () => {
  it("limits concurrent network submissions", async () => {
    vi.useFakeTimers();
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
        documentId: asSyncDocId("doc_a"),
        ciphertext: new Uint8Array([i]),
        nonce: nonce(i),
        signature: sig(i),
        authorPublicKey: pubkey(1),
      });
    }

    const done = submitCorrectionEnvelopes(
      { networkAdapter, storageAdapter, onError },
      asSyncDocId("doc_a"),
      envelopes,
    );

    // Advance fake timers to resolve all setTimeout(10) calls
    await vi.advanceTimersByTimeAsync(100);
    await done;

    // All 10 should be submitted
    expect(submitChange).toHaveBeenCalledTimes(10);

    // Concurrency should be bounded at 5 (CORRECTION_ENVELOPE_CONCURRENCY)
    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(0);

    // All 10 should be persisted
    expect(appendChange).toHaveBeenCalledTimes(10);
    expect(onError).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("persists only successful submissions and reports failures", async () => {
    let callCount = 0;

    const submitChange = vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        callCount++;
        const seq = callCount;
        // Even-numbered calls fail
        if (seq % 2 === 0) {
          return Promise.reject(new Error(`Submit failed for seq ${String(seq)}`));
        }
        return Promise.resolve({ ...change, seq });
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

    const envelopes: Omit<EncryptedChangeEnvelope, "seq">[] = [];
    for (let i = 1; i <= 6; i++) {
      envelopes.push({
        documentId: asSyncDocId("doc_a"),
        ciphertext: new Uint8Array([i]),
        nonce: nonce(i),
        signature: sig(i),
        authorPublicKey: pubkey(1),
      });
    }

    await submitCorrectionEnvelopes(
      { networkAdapter, storageAdapter, onError },
      asSyncDocId("doc_a"),
      envelopes,
    );

    // All 6 should be attempted
    expect(submitChange).toHaveBeenCalledTimes(6);

    // 3 fail (even-numbered), 3 succeed (odd-numbered)
    expect(onError).toHaveBeenCalledTimes(3);

    // Only successful submissions should be persisted
    expect(appendChange).toHaveBeenCalledTimes(3);
  });
});
