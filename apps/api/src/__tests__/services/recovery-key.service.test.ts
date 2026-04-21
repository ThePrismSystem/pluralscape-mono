import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { MockChain } from "../helpers/mock-db.js";
import type { AccountId } from "@pluralscape/types";

// ── Mock external dependencies ───────────────────────────────────────

const mockHashAuthKey = vi.fn<(authKey: Uint8Array) => Uint8Array>();
mockHashAuthKey.mockImplementation(() => new Uint8Array(64));

const mockVerifyAuthKey = vi.fn<(authKey: Uint8Array, storedHash: Uint8Array) => boolean>();
mockVerifyAuthKey.mockImplementation(() => true);

const mockVerifyRecoveryKey = vi.fn<(rawKey: Uint8Array, storedHash: Uint8Array) => boolean>();
mockVerifyRecoveryKey.mockImplementation(() => true);

vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return {
    ...actual,
    getSodium: () => ({
      randomBytes: (n: number) => new Uint8Array(n),
      genericHash: (_outLen: number, data: Uint8Array) => {
        // deterministic stub: XOR each byte with 0xa5 repeated, truncated to outLen
        const out = new Uint8Array(64);
        for (let i = 0; i < out.length; i++) out[i] = (data[i % data.length] ?? 0) ^ 0xa5;
        return out;
      },
    }),
    hashAuthKey: (authKey: Uint8Array) => mockHashAuthKey(authKey),
    verifyAuthKey: (authKey: Uint8Array, storedHash: Uint8Array) =>
      mockVerifyAuthKey(authKey, storedHash),
    verifyRecoveryKey: (rawKey: Uint8Array, storedHash: Uint8Array) =>
      mockVerifyRecoveryKey(rawKey, storedHash),
    assertAuthKey: vi.fn(),
    assertAuthKeyHash: vi.fn(),
    assertRecoveryKeyHash: vi.fn(),
  };
});

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: vi.fn().mockReturnValue("hashed_email_hex"),
  getEmailHashPepper: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

// Pass-through mock: ensures vitest module resolution for drizzle-orm remains
// stable when other mocked modules (rls-context, entity-lifecycle) import it.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual };
});

const mockEqualizeAntiEnumTiming = vi
  .fn<(startTime: number) => Promise<void>>()
  .mockResolvedValue(undefined);
vi.mock("../../lib/anti-enum-timing.js", () => ({
  equalizeAntiEnumTiming: (startTime: number): Promise<void> =>
    mockEqualizeAntiEnumTiming(startTime),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getRecoveryKeyStatus } = await import("../../services/recovery-key/status.js");
const { regenerateRecoveryKeyBackup } = await import(
  "../../services/recovery-key/regenerate.js"
);
const { resetPasswordWithRecoveryKey } = await import(
  "../../services/recovery-key/reset-password.js"
);
const { NoActiveRecoveryKeyError } = await import("../../services/recovery-key/internal.js");

// ── Tests ────────────────────────────────────────────────────────────

const { methods: logMethods } = createMockLogger();

/** 64-char hex string representing a valid authKey (32 bytes). */
const VALID_AUTH_KEY = "ab".repeat(32);
/** 64-char hex string representing a valid newAuthKey (32 bytes). */
const VALID_NEW_AUTH_KEY = "cd".repeat(32);
/** 32-char hex string representing a valid kdfSalt (16 bytes). */
const VALID_KDF_SALT = "ef".repeat(16);
/** Hex-encoded dummy encrypted master key blob. */
const VALID_ENC_MASTER_KEY = "aa".repeat(72);
/** Hex-encoded dummy recovery-encrypted master key blob. */
const VALID_RECOVERY_ENC_KEY = "bb".repeat(72);
/** 64-char hex string representing a valid recovery key hash (32 bytes). */
const VALID_RECOVERY_KEY_HASH = "dd".repeat(32);

describe("recovery-key service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    mockHashAuthKey.mockClear();
    mockVerifyAuthKey.mockClear();
    mockVerifyRecoveryKey.mockClear();
    mockAudit.mockClear();
    logMethods.error.mockClear();
    logMethods.warn.mockClear();
    logMethods.info.mockClear();
    logMethods.debug.mockClear();
  });

  // ── getRecoveryKeyStatus ──────────────────────────────────────────

  describe("getRecoveryKeyStatus", () => {
    it("returns hasActiveKey true when active key exists", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        { id: "rk_abc", accountId: "acct_123", createdAt: 1000, revokedAt: null },
      ]);

      const result = await getRecoveryKeyStatus(db, brandId<AccountId>("acct_123"));
      expect(result).toEqual({ hasActiveKey: true, createdAt: 1000 });
    });

    it("returns hasActiveKey false when no active key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await getRecoveryKeyStatus(db, brandId<AccountId>("acct_123"));
      expect(result).toEqual({ hasActiveKey: false, createdAt: null });
    });
  });

  // ── regenerateRecoveryKeyBackup ───────────────────────────────────

  describe("regenerateRecoveryKeyBackup", () => {
    const validParams = {
      authKey: VALID_AUTH_KEY,
      newRecoveryEncryptedMasterKey: VALID_RECOVERY_ENC_KEY,
      recoveryKeyHash: VALID_RECOVERY_KEY_HASH,
      confirmed: true as const,
    };

    it("returns ok:true on success", async () => {
      const { db, chain } = mockDb();
      // Account lookup
      chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(64) }]);
      // Active recovery key lookup
      chain.limit.mockResolvedValueOnce([
        { id: "rk_old", accountId: "acct_123", createdAt: 500, revokedAt: null },
      ]);
      // Revoke returning
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      const result = await regenerateRecoveryKeyBackup(
        db,
        brandId<AccountId>("acct_123"),
        validParams,
        mockAudit,
      );
      expect(result).toEqual({ ok: true });
    });

    it("calls verifyAuthKey with parsed authKey and stored hash", async () => {
      const { db, chain } = mockDb();
      const storedHash = new Uint8Array(64).fill(0xff);
      chain.limit.mockResolvedValueOnce([{ authKeyHash: storedHash }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old" }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), validParams, mockAudit);

      expect(mockVerifyAuthKey).toHaveBeenCalledOnce();
      // Second arg should be the stored hash (or a Uint8Array copy of it)
      const [, passedHash] = mockVerifyAuthKey.mock.calls[0] as [Uint8Array, Uint8Array];
      expect(passedHash).toBeInstanceOf(Uint8Array);
    });

    it("throws ValidationError on wrong authKey", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(64) }]);
      mockVerifyAuthKey.mockReturnValueOnce(false);

      await expect(
        regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), validParams, mockAudit),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws ValidationError when account not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_missing"), validParams, mockAudit),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws ZodError when confirmed is false", async () => {
      const { db } = mockDb();

      await expect(
        regenerateRecoveryKeyBackup(
          db,
          brandId<AccountId>("acct_123"),
          { ...validParams, confirmed: false },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("throws NoActiveRecoveryKeyError when no active key to revoke", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(64) }]);
      // No active recovery key
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), validParams, mockAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });

    it("throws ZodError on invalid input", async () => {
      const { db } = mockDb();

      await expect(
        regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), {}, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("throws when recovery key revoked concurrently (TOCTOU)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(64) }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old" }]);
      // Concurrent revocation
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), validParams, mockAudit),
      ).rejects.toThrow("Recovery key not found during revocation");
    });

    it("uses a transaction for the revoke+insert+audit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(64) }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old" }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await regenerateRecoveryKeyBackup(db, brandId<AccountId>("acct_123"), validParams, mockAudit);

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
      newAuthKey: VALID_NEW_AUTH_KEY,
      newKdfSalt: VALID_KDF_SALT,
      newEncryptedMasterKey: VALID_ENC_MASTER_KEY,
      newRecoveryEncryptedMasterKey: VALID_RECOVERY_ENC_KEY,
      recoveryKeyHash: VALID_RECOVERY_KEY_HASH,
      newRecoveryKeyHash: VALID_RECOVERY_KEY_HASH,
    };

    it("returns session token and accountId on success", async () => {
      const { db, chain } = mockDb();
      // Account lookup by emailHash
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      // Active recovery key lookup (includes recoveryKeyHash)
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      // Recovery key revocation returns success
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).not.toBeNull();
      const r = result as NonNullable<typeof result>;
      expect(r.sessionToken).toBeTruthy();
      expect(r.accountId).toBe("acct_123");
      // recoveryKey is no longer returned
      expect(r).not.toHaveProperty("recoveryKey");
    });

    it("calls hashAuthKey with the new auth key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(mockHashAuthKey).toHaveBeenCalledOnce();
    });

    it("returns null when account not found (anti-enumeration)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).toBeNull();
    });

    it("calls equalizeAntiEnumTiming when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      mockEqualizeAntiEnumTiming.mockClear();

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("throws NoActiveRecoveryKeyError when no active recovery key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });

    it("calls equalizeAntiEnumTiming when no active recovery key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([]);
      mockEqualizeAntiEnumTiming.mockClear();

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);

      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("throws ZodError on invalid input", async () => {
      const { db } = mockDb();

      await expect(
        resetPasswordWithRecoveryKey(db, { email: "bad" }, "web", mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("uses a transaction for the atomic update", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      // Two transaction calls: withAccountRead (recovery key lookup) + withAccountTransaction (atomic update)
      expect(chain.transaction).toHaveBeenCalledTimes(2);
    });

    it("throws when recovery key revoked concurrently (TOCTOU)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      // Concurrent revocation
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow("Recovery key not found during revocation");
    });

    it("calls equalizeAntiEnumTiming on the success path", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      chain.returning.mockResolvedValueOnce([{ id: "rk_old" }]);
      mockEqualizeAntiEnumTiming.mockClear();

      await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("calls equalizeAntiEnumTiming when transaction throws", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      mockEqualizeAntiEnumTiming.mockClear();

      let txCallCount = 0;
      chain.transaction = vi.fn<(fn: (tx: MockChain) => Promise<void>) => Promise<void>>((fn) => {
        txCallCount++;
        if (txCallCount === 2) return Promise.reject(new Error("tx failure"));
        return fn(chain);
      });

      await expect(
        resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit),
      ).rejects.toThrow("tx failure");

      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("rejects when recoveryKeyHash doesn't match stored hash", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: new Uint8Array(64) }]);
      mockVerifyRecoveryKey.mockReturnValueOnce(false);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).toBeNull();
      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalled();
    });

    it("rejects when recovery key has no stored hash", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "acct_123" }]);
      chain.limit.mockResolvedValueOnce([{ id: "rk_old", recoveryKeyHash: null }]);

      const result = await resetPasswordWithRecoveryKey(db, validResetParams, "web", mockAudit);

      expect(result).toBeNull();
      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalled();
    });
  });
});
