/**
 * Correction envelope submission tests.
 *
 * Verifies that correction envelopes are submitted in parallel (M7)
 * and individual failures are logged without blocking other submissions.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { submitCorrectionEnvelopes } from "../engine/sync-engine.js";

import { asSyncDocId, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";

// ── Test constants ─────────────────────────────────────────────────

const DOC_A_ID = asSyncDocId("doc_a");

// ── Mock factories ─────────────────────────────────────────────────

function mockNetworkAdapter(overrides: Partial<SyncNetworkAdapter> = {}): SyncNetworkAdapter {
  let seqCounter = 0;
  return {
    submitChange: vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        seqCounter++;
        return Promise.resolve({ ...change, seq: seqCounter });
      }),
    fetchChangesSince: vi.fn().mockResolvedValue([]),
    submitSnapshot: vi.fn().mockResolvedValue(undefined),
    fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    fetchManifest: vi.fn().mockResolvedValue({ systemId: "sys_test", documents: [] }),
    ...overrides,
  };
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

function makeTestEnvelopes(count: number): Omit<EncryptedChangeEnvelope, "seq">[] {
  const envelopes: Omit<EncryptedChangeEnvelope, "seq">[] = [];
  for (let i = 1; i <= count; i++) {
    envelopes.push({
      documentId: DOC_A_ID,
      ciphertext: new Uint8Array([i]),
      nonce: nonce(i),
      signature: sig(i),
      authorPublicKey: pubkey(1),
    });
  }
  return envelopes;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("submitCorrectionEnvelopes (M7)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits all correction envelopes in parallel and logs individual failures", async () => {
    let callCount = 0;
    const parallelSubmitChange = vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        callCount++;
        const currentCall = callCount;
        if (currentCall === 2) {
          return Promise.reject(new Error("Network error on envelope 2"));
        }
        return Promise.resolve({ ...change, seq: currentCall });
      });
    const onError = vi.fn();
    const appendChange = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter();
    storageAdapter.appendChange = appendChange;

    await submitCorrectionEnvelopes(
      {
        networkAdapter: mockNetworkAdapter({ submitChange: parallelSubmitChange }),
        storageAdapter,
        onError,
      },
      DOC_A_ID,
      makeTestEnvelopes(3),
    );

    // All 3 envelopes should have been submitted
    expect(parallelSubmitChange).toHaveBeenCalledTimes(3);

    // The second one failed, so only 2 should have been persisted
    expect(appendChange).toHaveBeenCalledTimes(2);

    // The failure should have been logged individually
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      "Failed to submit correction envelope for doc_a",
      expect.any(Error),
    );
  });

  it("handles empty envelopes array without calling network", async () => {
    const submitChange = vi.fn();
    const networkAdapter = mockNetworkAdapter({ submitChange });
    const onError = vi.fn();

    await submitCorrectionEnvelopes(
      { networkAdapter, storageAdapter: mockStorageAdapter(), onError },
      DOC_A_ID,
      [],
    );

    expect(submitChange).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("succeeds when all envelopes submit successfully", async () => {
    const onError = vi.fn();
    const appendChange = vi.fn().mockResolvedValue(undefined);
    const storageAdapter = mockStorageAdapter();
    storageAdapter.appendChange = appendChange;

    await submitCorrectionEnvelopes(
      { networkAdapter: mockNetworkAdapter(), storageAdapter, onError },
      DOC_A_ID,
      makeTestEnvelopes(2),
    );

    // All should be persisted
    expect(appendChange).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });
});
