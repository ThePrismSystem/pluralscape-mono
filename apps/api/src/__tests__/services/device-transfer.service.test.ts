import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { approveTransfer } from "../../services/device-transfer/approve.js";
import { completeTransfer } from "../../services/device-transfer/complete.js";
import {
  KeyDerivationUnavailableError,
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferSessionMismatchError,
  TransferValidationError,
} from "../../services/device-transfer/errors.js";
import { initiateTransfer } from "../../services/device-transfer/initiate.js";
import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, SessionId } from "@pluralscape/types";

// ── Mock external dependencies ─────────────────────────────────────────

const { mockDecryptFromTransfer, mockIsValidTransferCode, MockWorkerError } = vi.hoisted(() => ({
  mockDecryptFromTransfer: vi.fn(() => new Uint8Array(32)),
  mockIsValidTransferCode: vi.fn(() => true),
  MockWorkerError: class WorkerError extends Error {
    override readonly name = "WorkerError" as const;
  },
}));

vi.mock("@pluralscape/crypto", () => ({
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  AEAD_TAG_BYTES: 16,
  TRANSFER_TIMEOUT_MS: 300_000,
  assertPwhashSalt: vi.fn(),
  assertAeadKey: vi.fn(),
  decryptFromTransfer: mockDecryptFromTransfer,
  isValidTransferCode: mockIsValidTransferCode,
  DecryptionFailedError: class DecryptionFailedError extends Error {
    override readonly name = "DecryptionFailedError" as const;
  },
}));

vi.mock("../../lib/kdf-offload.js", () => ({
  deriveTransferKeyOffload: vi.fn(() => Promise.resolve(new Uint8Array(32))),
  WorkerError: MockWorkerError,
}));

vi.mock("@pluralscape/types", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/types")>("@pluralscape/types");
  return {
    ...actual,
    createId: vi.fn(() => "dtr_test-uuid"),
    now: vi.fn(() => 1000000),
  };
});

const ACCOUNT_ID = brandId<AccountId>("acc_test-account");
const SESSION_ID = brandId<SessionId>("sess_test-session");
const TARGET_SESSION_ID = brandId<SessionId>("sess_target-session");

/** 16-byte salt hex (32 hex chars = 16 bytes). */
const VALID_SALT_HEX = "00".repeat(16);

/** Minimal valid encrypted payload: 24 (nonce) + 16 (tag) = 40 bytes. */
const VALID_ENCRYPTED_HEX = "00".repeat(40);

const mockAudit: AuditWriter = vi.fn(async () => {});

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "dtr_test",
    encryptedKeyMaterial: new Uint8Array(40),
    codeSalt: new Uint8Array(16),
    codeAttempts: 0,
    ...overrides,
  };
}

describe("device-transfer.service", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Restore defaults that clearAllMocks removes
    mockDecryptFromTransfer.mockImplementation(() => new Uint8Array(32));
    mockIsValidTransferCode.mockImplementation(() => true);
  });

  describe("initiateTransfer", () => {
    it("rejects codeSalt with wrong length", async () => {
      const { db } = mockDb();
      const badSaltHex = "00".repeat(8); // 8 bytes, not 16

      await expect(
        initiateTransfer(
          db,
          ACCOUNT_ID,
          SESSION_ID,
          {
            codeSaltHex: badSaltHex,
            encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
          },
          mockAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });

    it("rejects invalid encryptedKeyMaterial (too short)", async () => {
      const { db } = mockDb();

      await expect(
        initiateTransfer(
          db,
          ACCOUNT_ID,
          SESSION_ID,
          {
            codeSaltHex: VALID_SALT_HEX,
            encryptedKeyMaterialHex: "00".repeat(10), // 10 bytes, need at least 40
          },
          mockAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });

    it("rejects invalid hex input", async () => {
      const { db } = mockDb();

      await expect(
        initiateTransfer(
          db,
          ACCOUNT_ID,
          SESSION_ID,
          {
            codeSaltHex: "not-valid-hex!!",
            encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
          },
          mockAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });

    it("inserts a transfer request within a transaction", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValue([{ id: "dtr_test-uuid" }]);

      const result = await initiateTransfer(
        db,
        ACCOUNT_ID,
        SESSION_ID,
        {
          codeSaltHex: VALID_SALT_HEX,
          encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
        },
        mockAudit,
      );

      expect(result.transferId).toBe("dtr_test-uuid");
      expect(result.expiresAt).toBe(1000000 + 300_000);
      expect(chain.transaction).toHaveBeenCalled();
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalled();
    });
  });

  describe("approveTransfer", () => {
    it("approves a pending transfer when session matches", async () => {
      const { db, chain } = mockDb();
      // SELECT: find pending transfer
      chain.limit.mockResolvedValueOnce([{ id: "dtr_test", sourceSessionId: SESSION_ID }]);
      // UPDATE: set status to approved, returning
      chain.returning.mockResolvedValueOnce([{ id: "dtr_test" }]);

      await approveTransfer(db, "dtr_test", ACCOUNT_ID, SESSION_ID, mockAudit);

      expect(chain.update).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "auth.device-transfer-approved" }),
      );
    });

    it("throws TransferNotFoundError when transfer not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        approveTransfer(db, "dtr_nonexistent", ACCOUNT_ID, SESSION_ID, mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferSessionMismatchError when session does not match", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "dtr_test", sourceSessionId: "sess_other" }]);

      await expect(
        approveTransfer(db, "dtr_test", ACCOUNT_ID, SESSION_ID, mockAudit),
      ).rejects.toThrow(TransferSessionMismatchError);
    });

    it("throws TransferNotFoundError on double-approval race", async () => {
      const { db, chain } = mockDb();
      // SELECT: find pending transfer
      chain.limit.mockResolvedValueOnce([{ id: "dtr_test", sourceSessionId: SESSION_ID }]);
      // UPDATE: returns empty (concurrent approval already changed status)
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        approveTransfer(db, "dtr_test", ACCOUNT_ID, SESSION_ID, mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });
  });

  describe("completeTransfer", () => {
    let db: ReturnType<typeof mockDb>["db"];
    let chain: ReturnType<typeof mockDb>["chain"];

    beforeEach(() => {
      const mocked = mockDb();
      db = mocked.db;
      chain = mocked.chain;
    });

    it("throws TransferValidationError for invalid code format", async () => {
      mockIsValidTransferCode.mockReturnValue(false);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "abc", mockAudit),
      ).rejects.toThrow(TransferValidationError);
    });

    it("throws TransferNotFoundError when no matching row", async () => {
      chain.limit.mockResolvedValue([]);

      await expect(
        completeTransfer(
          db,
          "dtr_nonexistent",
          ACCOUNT_ID,
          TARGET_SESSION_ID,
          "12345678",
          mockAudit,
        ),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferNotFoundError when encryptedKeyMaterial is null", async () => {
      chain.limit.mockResolvedValue([makeRow({ encryptedKeyMaterial: null })]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("returns encryptedKeyMaterialHex on correct code", async () => {
      const keyMaterial = new Uint8Array(40);
      keyMaterial[0] = 1;
      keyMaterial[1] = 2;

      chain.limit.mockResolvedValue([makeRow({ encryptedKeyMaterial: keyMaterial })]);
      chain.returning.mockResolvedValue([{ id: "dtr_test" }]);

      const result = await completeTransfer(
        db,
        "dtr_test",
        ACCOUNT_ID,
        TARGET_SESSION_ID,
        "12345678",
        mockAudit,
      );

      expect(result.encryptedKeyMaterialHex).toHaveLength(80); // 40 bytes = 80 hex chars
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalled();
    });

    it("successful completion deletes the transfer record", async () => {
      chain.limit.mockResolvedValue([makeRow()]);
      chain.returning.mockResolvedValue([{ id: "dtr_test" }]);

      await completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit);

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.returning).toHaveBeenCalled();
    });

    it("throws TransferNotFoundError on concurrent completion (delete returns 0 rows)", async () => {
      chain.limit.mockResolvedValue([makeRow()]);
      chain.returning.mockResolvedValue([]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws KeyDerivationUnavailableError when worker pool fails", async () => {
      const { deriveTransferKeyOffload } = await import("../../lib/kdf-offload.js");
      vi.mocked(deriveTransferKeyOffload).mockRejectedValueOnce(
        new MockWorkerError("pwhash worker timeout"),
      );

      chain.limit.mockResolvedValue([makeRow()]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(KeyDerivationUnavailableError);
    });

    it("increments codeAttempts atomically on wrong code", async () => {
      const { DecryptionFailedError } = await import("@pluralscape/crypto");
      mockDecryptFromTransfer.mockImplementation(() => {
        throw new DecryptionFailedError("wrong key");
      });

      chain.limit.mockResolvedValue([makeRow({ codeAttempts: 0 })]);
      // Atomic UPDATE...RETURNING returns the incremented count
      chain.returning.mockResolvedValue([{ codeAttempts: 1 }]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "00000000", mockAudit),
      ).rejects.toThrow(TransferCodeError);

      expect(chain.update).toHaveBeenCalled();
      expect(chain.returning).toHaveBeenCalled();
    });

    it("expires transfer after max attempts", async () => {
      const { DecryptionFailedError } = await import("@pluralscape/crypto");
      mockDecryptFromTransfer.mockImplementation(() => {
        throw new DecryptionFailedError("wrong key");
      });

      chain.limit.mockResolvedValue([makeRow({ codeAttempts: 4 })]);
      // Atomic increment returns 5 (>= MAX_TRANSFER_CODE_ATTEMPTS)
      chain.returning.mockResolvedValue([{ codeAttempts: 5 }]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "00000000", mockAudit),
      ).rejects.toThrow(TransferExpiredError);
    });

    it("throws TransferNotFoundError when atomic update returns 0 rows (concurrent race)", async () => {
      const { DecryptionFailedError } = await import("@pluralscape/crypto");
      mockDecryptFromTransfer.mockImplementation(() => {
        throw new DecryptionFailedError("wrong key");
      });

      chain.limit.mockResolvedValue([makeRow()]);
      // UPDATE...RETURNING returns empty — transfer was concurrently modified
      chain.returning.mockResolvedValue([]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "00000000", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("re-throws non-DecryptionFailedError errors", async () => {
      mockDecryptFromTransfer.mockImplementation(() => {
        throw new TypeError("unexpected error");
      });

      chain.limit.mockResolvedValue([makeRow()]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TypeError);
    });

    it("throws TransferNotFoundError for time-expired transfer (empty SELECT)", async () => {
      chain.limit.mockResolvedValue([]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferNotFoundError for wrong accountId (empty SELECT)", async () => {
      const OTHER_ACCOUNT = brandId<AccountId>("acc_other-account");
      chain.limit.mockResolvedValue([]);

      await expect(
        completeTransfer(db, "dtr_test", OTHER_ACCOUNT, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });
  });
});
