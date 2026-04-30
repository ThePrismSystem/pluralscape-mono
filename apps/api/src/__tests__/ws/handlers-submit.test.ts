import { getSodium, initSodium } from "@pluralscape/crypto";
import { EncryptedRelay } from "@pluralscape/sync";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Envelope signature verification is unconditional. Mock data has invalid
// signatures, so we stub verifyEnvelopeSignature at module-mock time.
vi.mock("@pluralscape/sync", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
  return {
    ...actual,
    verifyEnvelopeSignature: vi.fn(() => true),
  };
});

import { handleSubmitChange, handleSubmitSnapshot } from "../../ws/handlers.js";
import { asSyncDocId, nonce, pubkey } from "../helpers/crypto-test-fixtures.js";
import {
  TEST_ACCOUNT_ID,
  isSubmitChangeResult,
  mockChangeWithoutSeq,
  mockDb,
  mockSnapshot,
} from "../helpers/ws-handlers-fixtures.js";

import type { SubmitChangeRequest, SubmitSnapshotRequest } from "@pluralscape/sync";

beforeAll(async () => {
  await initSodium();
});

describe("handleSubmitChange", () => {
  it("assigns a seq and returns ChangeAccepted with the sequenced envelope", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const correlationId = crypto.randomUUID();

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId,
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService(), mockDb(), TEST_ACCOUNT_ID);
    expect(isSubmitChangeResult(result)).toBe(true);
    if (!isSubmitChangeResult(result)) return;

    expect(result.response.type).toBe("ChangeAccepted");
    expect(result.response.correlationId).toBe(correlationId);
    expect(result.response.docId).toBe(docId);
    expect(result.response.assignedSeq).toBe(1);
    expect(result.sequencedEnvelope.seq).toBe(1);
    expect(result.sequencedEnvelope.documentId).toBe(docId);
  });

  it("assigns monotonically increasing seq values", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    const msg1: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };
    const msg2: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result1 = await handleSubmitChange(msg1, relay.asService(), mockDb(), TEST_ACCOUNT_ID);
    const result2 = await handleSubmitChange(msg2, relay.asService(), mockDb(), TEST_ACCOUNT_ID);

    expect(isSubmitChangeResult(result1)).toBe(true);
    expect(isSubmitChangeResult(result2)).toBe(true);
    if (!isSubmitChangeResult(result1) || !isSubmitChangeResult(result2)) return;

    expect(result1.response.assignedSeq).toBe(1);
    expect(result2.response.assignedSeq).toBe(2);
  });

  it("overrides documentId in the change with the request docId", async () => {
    const relay = new EncryptedRelay();
    const requestDocId = asSyncDocId(crypto.randomUUID());
    const differentDocId = asSyncDocId(crypto.randomUUID());

    const changeWithDifferentDoc = mockChangeWithoutSeq(differentDocId);

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId: requestDocId,
      change: changeWithDifferentDoc,
    };

    const result = await handleSubmitChange(message, relay.asService(), mockDb(), TEST_ACCOUNT_ID);
    expect(isSubmitChangeResult(result)).toBe(true);
    if (!isSubmitChangeResult(result)) return;

    expect(result.response.docId).toBe(requestDocId);
    expect(result.sequencedEnvelope.documentId).toBe(requestDocId);

    // Verify the relay stored it under the request docId
    const storedResult = await relay.getEnvelopesSince(requestDocId, 0);
    expect(storedResult.envelopes).toHaveLength(1);
    expect(storedResult.envelopes[0]?.documentId).toBe(requestDocId);
  });
});

describe("handleSubmitSnapshot", () => {
  it("returns SnapshotAccepted for a valid snapshot", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const correlationId = crypto.randomUUID();

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId,
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(
      message,
      relay.asService(),
      mockDb(),
      TEST_ACCOUNT_ID,
    );

    expect(result.type).toBe("SnapshotAccepted");
    expect(result.correlationId).toBe(correlationId);
    if (result.type === "SnapshotAccepted") {
      expect(result.docId).toBe(docId);
      expect(result.snapshotVersion).toBe(1);
    }
  });

  it("returns SyncError with VERSION_CONFLICT when snapshot version is not newer", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    // Submit version 2 first
    await relay.submitSnapshot(mockSnapshot(docId, 2));

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(
      message,
      relay.asService(),
      mockDb(),
      TEST_ACCOUNT_ID,
    );

    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("VERSION_CONFLICT");
      expect(result.docId).toBe(docId);
    }
  });

  it("returns SyncError when submitting the same version", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    await relay.submitSnapshot(mockSnapshot(docId, 1));

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(
      message,
      relay.asService(),
      mockDb(),
      TEST_ACCOUNT_ID,
    );

    expect(result.type).toBe("SyncError");
  });

  it("overrides documentId in the snapshot with the request docId", async () => {
    const relay = new EncryptedRelay();
    const requestDocId = asSyncDocId(crypto.randomUUID());
    const differentDocId = asSyncDocId(crypto.randomUUID());

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId: requestDocId,
      snapshot: mockSnapshot(differentDocId, 1),
    };

    const result = await handleSubmitSnapshot(
      message,
      relay.asService(),
      mockDb(),
      TEST_ACCOUNT_ID,
    );

    expect(result.type).toBe("SnapshotAccepted");

    // Verify the relay stored it under the request docId
    const stored = await relay.getLatestSnapshot(requestDocId);
    expect(stored).not.toBeNull();
    expect(stored?.documentId).toBe(requestDocId);
  });
});

// ── Sec-M2: Signature verification tests ────────────────────────────
//
// Server-side Ed25519 verification is unconditional. The file-level mock of
// `verifyEnvelopeSignature` returns true by default; individual tests override
// with the real implementation (or a specific return value) to exercise
// verification outcomes.

describe("handleSubmitChange envelope signature verification (Sec-M2)", () => {
  beforeAll(async () => {
    await initSodium();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function useRealVerify(): Promise<void> {
    const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockImplementation(
      actual.verifyEnvelopeSignature,
    );
  }

  it("returns SyncError with INVALID_ENVELOPE when signature is invalid", async () => {
    await useRealVerify();

    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    // Mock data has random bytes as signatures — they will fail verification
    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService(), mockDb(), TEST_ACCOUNT_ID);

    expect(isSubmitChangeResult(result)).toBe(false);
    if (!isSubmitChangeResult(result)) {
      expect(result.type).toBe("SyncError");
      expect(result.code).toBe("INVALID_ENVELOPE");
      expect(result.docId).toBe(docId);
    }

    // Verify nothing was stored in the relay
    const stored = await relay.getEnvelopesSince(docId, 0);
    expect(stored.envelopes).toHaveLength(0);
  });

  it("accepts a properly signed envelope", async () => {
    await useRealVerify();

    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    const sodium = getSodium();
    const { publicKey, secretKey } = sodium.signKeypair();
    const ciphertext = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const signature = sodium.signDetached(ciphertext, secretKey);

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: {
        ciphertext,
        nonce: nonce(1),
        signature,
        authorPublicKey: publicKey,
        documentId: docId,
      },
    };

    const result = await handleSubmitChange(
      message,
      relay.asService(),
      mockDb(publicKey),
      TEST_ACCOUNT_ID,
    );

    expect(isSubmitChangeResult(result)).toBe(true);
    if (isSubmitChangeResult(result)) {
      expect(result.response.type).toBe("ChangeAccepted");
      expect(result.response.assignedSeq).toBe(1);
    }
  });

  it("returns INVALID_ENVELOPE when envelope fields have wrong byte lengths", async () => {
    await useRealVerify();

    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: {
        ciphertext: new Uint8Array([0xde, 0xad]),
        nonce: nonce(1),
        // 10-byte signature instead of required 64 bytes
        signature: new Uint8Array(10) as never,
        authorPublicKey: pubkey(0x05),
        documentId: docId,
      },
    };

    const result = await handleSubmitChange(message, relay.asService(), mockDb(), TEST_ACCOUNT_ID);

    expect(isSubmitChangeResult(result)).toBe(false);
    if (!isSubmitChangeResult(result)) {
      expect(result.type).toBe("SyncError");
      expect(result.code).toBe("INVALID_ENVELOPE");
    }

    // Nothing stored
    const stored = await relay.getEnvelopesSince(docId, 0);
    expect(stored.envelopes).toHaveLength(0);
  });
});
