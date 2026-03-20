import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferValidationError,
  completeTransfer,
  initiateTransfer,
} from "../../services/device-transfer.service.js";
import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, SessionId } from "@pluralscape/types";

// ── Mock external dependencies ─────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  AEAD_TAG_BYTES: 16,
  TRANSFER_TIMEOUT_MS: 300_000,
  assertPwhashSalt: vi.fn(),
  deriveTransferKey: vi.fn(() => new Uint8Array(32)),
  decryptFromTransfer: vi.fn(() => new Uint8Array(32)),
}));

vi.mock("@pluralscape/types", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/types")>("@pluralscape/types");
  return {
    ...actual,
    createId: vi.fn(() => "dtr_test-uuid"),
    now: vi.fn(() => 1000000),
  };
});

const ACCOUNT_ID = "acc_test-account" as AccountId;
const SESSION_ID = "sess_test-session" as SessionId;
const TARGET_SESSION_ID = "sess_target-session" as SessionId;

/** 16-byte salt hex (32 hex chars = 16 bytes). */
const VALID_SALT_HEX = "00".repeat(16);

/** Minimal valid encrypted payload: 24 (nonce) + 16 (tag) = 40 bytes. */
const VALID_ENCRYPTED_HEX = "00".repeat(40);

const mockAudit: AuditWriter = vi.fn(async () => {});

describe("device-transfer.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
      ).rejects.toThrow(); // deserializeEncryptedPayload throws
    });

    it("inserts a transfer request on success", async () => {
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
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalled();
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
      chain.limit.mockResolvedValue([
        {
          id: "dtr_test",
          accountId: ACCOUNT_ID,
          status: "pending",
          encryptedKeyMaterial: null,
          codeSalt: new Uint8Array(16),
          codeAttempts: 0,
          expiresAt: 2000000,
        },
      ]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "12345678", mockAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("returns encryptedKeyMaterialHex on correct code", async () => {
      // Must be at least 40 bytes (24 nonce + 16 tag minimum for deserializeEncryptedPayload)
      const keyMaterial = new Uint8Array(40);
      keyMaterial[0] = 1;
      keyMaterial[1] = 2;

      chain.limit.mockResolvedValue([
        {
          id: "dtr_test",
          accountId: ACCOUNT_ID,
          status: "pending",
          encryptedKeyMaterial: keyMaterial,
          codeSalt: new Uint8Array(16),
          codeAttempts: 0,
          expiresAt: 2000000,
        },
      ]);

      const result = await completeTransfer(
        db,
        "dtr_test",
        ACCOUNT_ID,
        TARGET_SESSION_ID,
        "12345678",
        mockAudit,
      );

      expect(result.encryptedKeyMaterialHex).toHaveLength(80); // 40 bytes = 80 hex chars
      expect(chain.update).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalled();
    });

    it("increments codeAttempts on wrong code", async () => {
      const { decryptFromTransfer } = await import("@pluralscape/crypto");
      vi.mocked(decryptFromTransfer).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      chain.limit.mockResolvedValue([
        {
          id: "dtr_test",
          accountId: ACCOUNT_ID,
          status: "pending",
          encryptedKeyMaterial: new Uint8Array(40),
          codeSalt: new Uint8Array(16),
          codeAttempts: 0,
          expiresAt: 2000000,
        },
      ]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "00000000", mockAudit),
      ).rejects.toThrow(TransferCodeError);

      expect(chain.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ codeAttempts: 1 }));
    });

    it("expires transfer after max attempts", async () => {
      const { decryptFromTransfer } = await import("@pluralscape/crypto");
      vi.mocked(decryptFromTransfer).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      chain.limit.mockResolvedValue([
        {
          id: "dtr_test",
          accountId: ACCOUNT_ID,
          status: "pending",
          encryptedKeyMaterial: new Uint8Array(40),
          codeSalt: new Uint8Array(16),
          codeAttempts: 4, // Next attempt (5th) hits the limit
          expiresAt: 2000000,
        },
      ]);

      await expect(
        completeTransfer(db, "dtr_test", ACCOUNT_ID, TARGET_SESSION_ID, "00000000", mockAudit),
      ).rejects.toThrow(TransferExpiredError);

      expect(chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "expired", codeAttempts: 5 }),
      );
    });
  });
});
