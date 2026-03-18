import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AccountId } from "@pluralscape/types";

// ── Mock external dependencies ───────────────────────────────────────

const mockMemzero = vi.fn();
const mockVerifyPassword = vi.fn((...args: [string, string]) => args[0] === "$argon2id$fake$valid");

vi.mock("@pluralscape/crypto", () => ({
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  AEAD_TAG_BYTES: 16,
  GENERIC_HASH_BYTES_MAX: 64,
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
    memzero: mockMemzero,
    genericHash: () => new Uint8Array(64),
  }),
  verifyPassword: (...args: [string, string]) => mockVerifyPassword(...args),
  derivePasswordKey: () => Promise.resolve(new Uint8Array(32)),
  unwrapMasterKey: () => new Uint8Array(32),
  hashPassword: () => "$argon2id$fake$newhash",
  regenerateRecoveryKey: () => ({
    newRecoveryKey: {
      displayKey: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
      encryptedMasterKey: {
        ciphertext: new Uint8Array(48),
        nonce: new Uint8Array(24),
      },
    },
    serializedBackup: new Uint8Array(72),
  }),
  resetPasswordViaRecoveryKey: () =>
    Promise.resolve({
      masterKey: new Uint8Array(32),
      newSalt: new Uint8Array(16),
      wrappedMasterKey: {
        ciphertext: new Uint8Array(48),
        nonce: new Uint8Array(24),
      },
      newRecoveryKey: {
        displayKey: "NEW-RKEY-ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL",
        encryptedMasterKey: {
          ciphertext: new Uint8Array(48),
          nonce: new Uint8Array(24),
        },
      },
    }),
  serializeRecoveryBackup: () => new Uint8Array(72),
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: vi.fn().mockReturnValue("hashed_email_hex"),
  getEmailHashPepper: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

// ── Imports after mocks ──────────────────────────────────────────

const {
  getRecoveryKeyStatus,
  regenerateRecoveryKeyBackup,
  resetPasswordWithRecoveryKey,
  NoActiveRecoveryKeyError,
} = await import("../../services/recovery-key.service.js");

// ── Tests ────────────────────────────────────────────────────────────

describe("recovery-key service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    mockMemzero.mockClear();
    mockVerifyPassword.mockClear();
    mockAudit.mockClear();
  });

  // ── getRecoveryKeyStatus ──────────────────────────────────────────

  describe("getRecoveryKeyStatus", () => {
    it("returns hasActiveKey true when active key exists", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        { id: "rk_abc", accountId: "acct_123", createdAt: 1000, revokedAt: null },
      ]);

      const result = await getRecoveryKeyStatus(db, "acct_123" as AccountId);
      expect(result).toEqual({ hasActiveKey: true, createdAt: 1000 });
    });

    it("returns hasActiveKey false when no active key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await getRecoveryKeyStatus(db, "acct_123" as AccountId);
      expect(result).toEqual({ hasActiveKey: false, createdAt: null });
    });
  });

  // ── regenerateRecoveryKeyBackup ───────────────────────────────────

  describe("regenerateRecoveryKeyBackup", () => {
    const validParams = {
      currentPassword: "password123",
      confirmed: true,
    };

    it("returns a new display key on success", async () => {
      const { db, chain } = mockDb();
      // Account lookup
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      // Active recovery key lookup
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      // Transaction: revoke returning + insert returning
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      const result = await regenerateRecoveryKeyBackup(
        db,
        "acct_123" as AccountId,
        validParams,
        mockAudit,
      );
      expect(result.recoveryKey).toBe(
        "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST",
      );
    });

    it("throws ValidationError on wrong password", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$invalid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws ValidationError when account not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_missing" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws ZodError when confirmed is false", async () => {
      const { db } = mockDb();

      await expect(
        regenerateRecoveryKeyBackup(
          db,
          "acct_123" as AccountId,
          { currentPassword: "password123", confirmed: false },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("throws NoActiveRecoveryKeyError when no active key to revoke", async () => {
      const { db, chain } = mockDb();
      // Account lookup
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      // No active recovery key
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });

    it("throws ZodError on invalid input", async () => {
      const { db } = mockDb();

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, {}, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("throws when account has no encrypted master key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: null,
        },
      ]);
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("Account missing encrypted master key");
    });

    it("throws on invalid KDF salt length", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(8),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("Stored KDF salt has invalid length");

      // KEK not derived yet, no crypto material to zero
      expect(mockMemzero).toHaveBeenCalledTimes(0);
    });

    it("throws when recovery key revoked concurrently (TOCTOU)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      // Revoke returns empty (concurrent revocation)
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("Recovery key not found during revocation");

      // Crypto material still zeroed despite transaction failure
      expect(mockMemzero).toHaveBeenCalledTimes(5);
    });

    it("calls memzero on KEK and master key even on transaction failure", async () => {
      const { db, chain } = mockDb();
      // Account lookup
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      // Active recovery key lookup
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      // Transaction fails
      chain.transaction.mockRejectedValueOnce(new Error("DB error"));

      await expect(
        regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit),
      ).rejects.toThrow("DB error");

      expect(mockMemzero).toHaveBeenCalledTimes(5);
    });

    it("calls memzero on success", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit);

      expect(mockMemzero).toHaveBeenCalledTimes(5);
    });

    it("uses a transaction for the revoke+insert+audit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await regenerateRecoveryKeyBackup(db, "acct_123" as AccountId, validParams, mockAudit);

      expect(chain.transaction).toHaveBeenCalledOnce();
    });
  });

  // ── NoActiveRecoveryKeyError ──────────────────────────────────────

  describe("NoActiveRecoveryKeyError", () => {
    it("has name set to NoActiveRecoveryKeyError", () => {
      const err = new NoActiveRecoveryKeyError("test");
      expect(err.name).toBe("NoActiveRecoveryKeyError");
    });

    it("extends Error", () => {
      const err = new NoActiveRecoveryKeyError("test");
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ── resetPasswordWithRecoveryKey ───────────────────────────────

  describe("resetPasswordWithRecoveryKey", () => {
    const validResetParams = {
      email: "test@example.com",
      recoveryKey: "ABCD-EFGH-IJKL-MNOP",
      newPassword: "newstrongpassword123",
    };

    it("returns session token and new recovery key on success", async () => {
      const { db, chain } = mockDb();
      // Account lookup by emailHash
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      // Active recovery key lookup
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", encryptedMasterKey: new Uint8Array(72) }]);
      // Recovery key revocation returns success
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).not.toBeNull();
      const r = result as NonNullable<typeof result>;
      expect(r.sessionToken).toBeTruthy();
      expect(r.recoveryKey).toBe("NEW-RKEY-ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL");
      expect(r.accountId).toBe("acct_123");
    });

    it("returns null when account not found (anti-enumeration)", async () => {
      const { db, chain } = mockDb();
      // No account found
      chain.limit.mockResolvedValueOnce([]);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).toBeNull();
    });

    it("calls verifyPassword for timing equalization when no active recovery key", async () => {
      const { db, chain } = mockDb();
      // Account found
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      // No active recovery key
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);

      // verifyPassword should have been called for timing equalization in the "no active key" path
      expect(mockVerifyPassword).toHaveBeenCalled();
    });

    it("throws ZodError on invalid input", async () => {
      const { db } = mockDb();

      await expect(
        resetPasswordWithRecoveryKey(db, { email: "bad" }, "web", mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("uses a transaction for the atomic update", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", encryptedMasterKey: new Uint8Array(72) }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(chain.transaction).toHaveBeenCalledOnce();
    });

    it("calls memzero on all crypto material after success", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", encryptedMasterKey: new Uint8Array(72) }]);
      // Recovery key revocation returns success
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      // masterKey, newSalt, wrappedMasterKeyBytes, newRecoveryBackupBytes,
      // newRecoveryKey.ciphertext, newRecoveryKey.nonce
      expect(mockMemzero).toHaveBeenCalledTimes(6);
    });

    it("throws when recovery key revoked concurrently (TOCTOU)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
        },
      ]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", encryptedMasterKey: new Uint8Array(72) }]);
      // Recovery key revocation returns empty (concurrent revocation)
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow("Recovery key not found during revocation");

      // Crypto material still zeroed despite transaction failure
      expect(mockMemzero).toHaveBeenCalledTimes(6);
    });
  });
});
