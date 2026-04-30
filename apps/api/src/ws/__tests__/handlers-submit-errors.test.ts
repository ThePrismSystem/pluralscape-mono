/**
 * Branch coverage for `apps/api/src/ws/handlers.ts` — submit paths.
 *
 * Covers handleSubmitChange and handleSubmitSnapshot error and edge cases:
 *   - InvalidInputError from getSodium → SyncError
 *   - verifyEnvelopeSignature returns false → SyncError
 *   - EnvelopeLimitExceededError → SyncError QUOTA_EXCEEDED
 *   - SnapshotVersionConflictError → SyncError VERSION_CONFLICT
 *   - SnapshotSizeLimitExceededError → SyncError QUOTA_EXCEEDED
 *   - relay.submit / submitSnapshot throws unknown error → rethrows
 *   - UNAUTHORIZED_KEY when authorPublicKey not in account keys
 *   - Success path
 */
import { InvalidInputError, initSodium } from "@pluralscape/crypto";
import {
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
  SnapshotVersionConflictError,
} from "@pluralscape/sync";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { handleSubmitChange, handleSubmitSnapshot } from "../handlers.js";

import {
  TEST_ACCOUNT_ID,
  brandedBytes,
  mockDb,
  mockRelay,
  mockSignatureValid,
} from "./handlers-fixtures.js";

import type { SubmitChangeRequest, SubmitSnapshotRequest } from "@pluralscape/sync";
import type { SyncDocumentId } from "@pluralscape/types";

beforeAll(async () => {
  await initSodium();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleSubmitChange", () => {
  function makeSubmitMsg(docId = "doc-sc-1"): SubmitChangeRequest {
    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    return {
      type: "SubmitChangeRequest",
      correlationId: "corr-sc",
      docId: brandId<SyncDocumentId>(docId),
      change: {
        ciphertext: ct,
        nonce,
        signature: sig,
        authorPublicKey: key,
        documentId: brandId<SyncDocumentId>(docId),
      },
    };
  }

  /** Key bytes used by makeSubmitMsg (fill=1, size=32). */
  const validKeyBytes = new Uint8Array(32).fill(1);

  it("returns SubmitChangeResult when signature verification passes", async () => {
    await mockSignatureValid();
    const { relay, submit } = mockRelay();
    submit.mockResolvedValue(42);
    const db = mockDb([validKeyBytes]);

    const result = await handleSubmitChange(makeSubmitMsg("doc-sc-ok"), relay, db, TEST_ACCOUNT_ID);
    expect(result.type).toBe("SubmitChangeResult");
    if (result.type === "SubmitChangeResult") {
      expect(result.response.assignedSeq).toBe(42);
    }
  });

  it("returns SyncError INVALID_ENVELOPE when InvalidInputError thrown by getSodium", async () => {
    // Mock getSodium to throw InvalidInputError
    const cryptoModule = await import("@pluralscape/crypto");
    vi.spyOn(cryptoModule, "getSodium").mockImplementation(() => {
      throw new InvalidInputError("sodium not ready");
    });

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-inv"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("rethrows non-InvalidInputError thrown by getSodium", async () => {
    const cryptoModule = await import("@pluralscape/crypto");
    vi.spyOn(cryptoModule, "getSodium").mockImplementation(() => {
      throw new Error("unexpected sodium error");
    });

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    await expect(
      handleSubmitChange(makeSubmitMsg("doc-sc-rethrow"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected sodium error");
  });

  it("returns SyncError INVALID_ENVELOPE when verifyEnvelopeSignature returns false", async () => {
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-false"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when authorPublicKey does not match account keys", async () => {
    await mockSignatureValid();
    const { relay } = mockRelay();
    // DB returns a different key than the one in the envelope
    const differentKey = new Uint8Array(32).fill(99);
    const db = mockDb([differentKey]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-badkey"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when account has no keys", async () => {
    await mockSignatureValid();
    const { relay } = mockRelay();
    const db = mockDb([]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-nokeys"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError QUOTA_EXCEEDED when relay.submit throws EnvelopeLimitExceededError", async () => {
    await mockSignatureValid();
    const { relay, submit } = mockRelay();
    submit.mockRejectedValue(new EnvelopeLimitExceededError("doc-sc-quota", 1000));
    const db = mockDb([validKeyBytes]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-quota"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("rethrows unknown errors from relay.submit", async () => {
    await mockSignatureValid();
    const { relay, submit } = mockRelay();
    submit.mockRejectedValue(new Error("unexpected relay error"));
    const db = mockDb([validKeyBytes]);

    await expect(
      handleSubmitChange(makeSubmitMsg("doc-sc-unknown"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected relay error");
  });
});

describe("handleSubmitSnapshot", () => {
  /** Key bytes used by makeSubmitSnapshotMsg (fill=1, size=32). */
  const validSnapshotKeyBytes = new Uint8Array(32).fill(1);

  function makeSubmitSnapshotMsg(docId = "doc-ss-1"): SubmitSnapshotRequest {
    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    return {
      type: "SubmitSnapshotRequest",
      correlationId: "corr-ss",
      docId: brandId<SyncDocumentId>(docId),
      snapshot: {
        ciphertext: ct,
        nonce,
        signature: sig,
        authorPublicKey: key,
        documentId: brandId<SyncDocumentId>(docId),
        snapshotVersion: 5,
      },
    };
  }

  it("returns SnapshotAccepted on success", async () => {
    await mockSignatureValid();
    const { relay } = mockRelay();
    const db = mockDb([validSnapshotKeyBytes]);
    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-ok"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SnapshotAccepted");
    if (result.type === "SnapshotAccepted") {
      expect(result.snapshotVersion).toBe(5);
    }
  });

  it("returns SyncError INVALID_ENVELOPE when snapshot signature is invalid", async () => {
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { relay } = mockRelay();
    const db = mockDb([validSnapshotKeyBytes]);
    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-badsig"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when snapshot authorPublicKey does not match account", async () => {
    await mockSignatureValid();
    const { relay } = mockRelay();
    const differentKey = new Uint8Array(32).fill(99);
    const db = mockDb([differentKey]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-badkey"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError VERSION_CONFLICT on SnapshotVersionConflictError", async () => {
    await mockSignatureValid();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new SnapshotVersionConflictError(6, 5));
    const db = mockDb([validSnapshotKeyBytes]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-vc"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("VERSION_CONFLICT");
    }
  });

  it("returns SyncError QUOTA_EXCEEDED on SnapshotSizeLimitExceededError", async () => {
    await mockSignatureValid();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new SnapshotSizeLimitExceededError("doc-ss-size", 2000, 1000));
    const db = mockDb([validSnapshotKeyBytes]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-size"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("rethrows unknown errors from relay.submitSnapshot", async () => {
    await mockSignatureValid();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new Error("unexpected snapshot error"));
    const db = mockDb([validSnapshotKeyBytes]);

    await expect(
      handleSubmitSnapshot(makeSubmitSnapshotMsg("doc-ss-unk"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected snapshot error");
  });
});
