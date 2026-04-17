import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { mockDb } from "../helpers/mock-db.js";

import type { MockChain } from "../helpers/mock-db.js";
import type { AccountId } from "@pluralscape/types";

// ── Mock external dependencies ───────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  AEAD_KEY_BYTES: 32,
  AUTH_KEY_HASH_BYTES: 32,
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  AEAD_TAG_BYTES: 16,
  assertAeadNonce: () => undefined,
  assertSignPublicKey: () => undefined,
  assertSignature: () => undefined,
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
  }),
  hashAuthKey: () => new Uint8Array(32),
  verifyAuthKey: (_authKey: Uint8Array, storedHash: Uint8Array) =>
    storedHash.every((b) => b === 0xab),
  verify: vi.fn().mockReturnValue(true),
  generateSalt: () => new Uint8Array(16),
  generateChallengeNonce: () => new Uint8Array(32),
  generateMasterKey: () => new Uint8Array(32),
  wrapMasterKey: () => ({
    ciphertext: new Uint8Array(48),
    nonce: new Uint8Array(24),
  }),
  unwrapMasterKey: () => new Uint8Array(32),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
}));

// Pass-through mock: ensures vitest module resolution for drizzle-orm remains
// stable when other mocked modules (rls-context, entity-lifecycle) import it.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual };
});

// ── Imports after mocks ──────────────────────────────────────────

const { getAccountInfo, changeEmail, changePassword, updateAccountSettings, ConcurrencyError } =
  await import("../../services/account.service.js");
const { verify: mockVerify } = await import("@pluralscape/crypto");

// ── Helpers ──────────────────────────────────────────────────────────

/** A valid 32-byte auth key encoded as hex (all 0xab bytes → verifyAuthKey returns true). */
const VALID_AUTH_KEY_HEX = "ab".repeat(32);
/** An invalid auth key hex — verifyAuthKey returns false for these bytes. */
const INVALID_AUTH_KEY_HEX = "00".repeat(32);
/** Stored authKeyHash where every byte is 0xab — matches VALID_AUTH_KEY_HEX in the mock. */
const VALID_AUTH_KEY_HASH = new Uint8Array(32).fill(0xab);
/** A valid signing public key (32 bytes). */
const VALID_SIGN_PUBLIC_KEY = new Uint8Array(32).fill(0x11);

const VALID_CHANGE_PASSWORD_PARAMS = {
  oldAuthKey: VALID_AUTH_KEY_HEX,
  newAuthKey: "cc".repeat(32),
  newKdfSalt: "dd".repeat(16),
  newEncryptedMasterKey: "ee".repeat(72),
  challengeSignature: "ff".repeat(64),
};

// ── Tests ────────────────────────────────────────────────────────────

describe("account service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── getAccountInfo ──────────────────────────────────────────────

  describe("getAccountInfo", () => {
    it("returns null when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await getAccountInfo(db, brandId<AccountId>("acct_notfound"));
      expect(result).toBeNull();
    });

    it("returns account info for system account with systemId", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            accountId: "acct_123",
            accountType: "system",
            auditLogIpTracking: false,
            version: 1,
            createdAt: 1000,
            updatedAt: 2000,
          },
        ])
        .mockResolvedValueOnce([{ id: "sys_456" }]);

      const result = await getAccountInfo(db, brandId<AccountId>("acct_123"));
      expect(result).toEqual({
        accountId: "acct_123",
        accountType: "system",
        systemId: "sys_456",
        auditLogIpTracking: false,
        version: 1,
        createdAt: 1000,
        updatedAt: 2000,
      });
    });

    it("returns null systemId for viewer accounts", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          accountId: "acct_789",
          accountType: "viewer",
          auditLogIpTracking: false,
          version: 1,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ]);

      const result = await getAccountInfo(db, brandId<AccountId>("acct_789"));
      expect(result).not.toBeNull();
      expect(result?.systemId).toBeNull();
    });

    it("returns null systemId when system row is missing for system account", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            accountId: "acct_123",
            accountType: "system",
            auditLogIpTracking: false,
            version: 1,
            createdAt: 1000,
            updatedAt: 2000,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await getAccountInfo(db, brandId<AccountId>("acct_123"));
      expect(result?.systemId).toBeNull();
    });
  });

  // ── changeEmail ─────────────────────────────────────────────────

  describe("changeEmail", () => {
    it("throws on invalid auth key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: new Uint8Array(32).fill(0x00),
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);

      await expect(
        changeEmail(
          db,
          brandId<AccountId>("acct_123"),
          { email: "new@example.com", authKey: INVALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        changeEmail(
          db,
          brandId<AccountId>("acct_missing"),
          { email: "new@example.com", authKey: VALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("returns kind:'noop' silently when email is unchanged", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: VALID_AUTH_KEY_HASH,
          emailHash: "hashed_same@example.com",
          version: 1,
        },
      ]);

      const result = await changeEmail(
        db,
        brandId<AccountId>("acct_123"),
        { email: "same@example.com", authKey: VALID_AUTH_KEY_HEX },
        mockAudit,
      );
      // No-op change — discriminant is "noop" so callers skip the notification enqueue.
      expect(result).toEqual({ kind: "noop" });
      // Transaction is called once for the withAccountRead lookup,
      // but NOT a second time for the write path (email is unchanged)
      expect(chain.transaction).toHaveBeenCalledOnce();
    });

    it("returns kind:'changed' with post-change version on successful email change", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: VALID_AUTH_KEY_HASH,
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);
      chain.returning.mockResolvedValueOnce([{ id: "acct_123" }]);

      const result = await changeEmail(
        db,
        brandId<AccountId>("acct_123"),
        { email: "new@example.com", authKey: VALID_AUTH_KEY_HEX },
        mockAudit,
      );
      // oldEmail is null because resolveAccountEmail needs EMAIL_ENCRYPTION_KEY
      // and the unit mock doesn't configure one; newEmail echoes the input.
      // version is preChangeVersion + 1 (1 + 1 = 2) — used by the notification
      // enqueue idempotency key so retries of the same change dedupe.
      expect(result).toEqual({
        kind: "changed",
        oldEmail: null,
        newEmail: "new@example.com",
        version: 2,
      });
    });

    it("throws generic error on duplicate email", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: VALID_AUTH_KEY_HASH,
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);

      const pgError = new Error("duplicate key value violates unique constraint");
      Object.assign(pgError, {
        code: PG_UNIQUE_VIOLATION,
        constraint_name: "accounts_email_hash_idx",
      });
      // First transaction call is the withAccountRead (succeeds normally),
      // second rejects with duplicate email error.
      let txCallCount = 0;
      chain.transaction = vi.fn<(fn: (tx: MockChain) => Promise<void>) => Promise<void>>((fn) => {
        txCallCount++;
        if (txCallCount === 2) return Promise.reject(pgError);
        return fn(chain);
      });

      await expect(
        changeEmail(
          db,
          brandId<AccountId>("acct_123"),
          { email: "taken@example.com", authKey: VALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow("Email change failed");
    });

    it("throws ZodError on invalid email format", async () => {
      const { db } = mockDb();
      await expect(
        changeEmail(
          db,
          brandId<AccountId>("acct_123"),
          { email: "not-an-email", authKey: VALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("uses optimistic locking via version", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: VALID_AUTH_KEY_HASH,
          emailHash: "hashed_old@example.com",
          version: 5,
        },
      ]);
      // Optimistic lock fails — no rows updated
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        changeEmail(
          db,
          brandId<AccountId>("acct_123"),
          { email: "new@example.com", authKey: VALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow("Account was modified concurrently");
    });
  });

  // ── changePassword ──────────────────────────────────────────────

  describe("changePassword", () => {
    it("throws on invalid old auth key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          authKeyHash: new Uint8Array(32).fill(0x00),
          version: 1,
        },
      ]);

      await expect(
        changePassword(
          db,
          brandId<AccountId>("acct_123"),
          { ...VALID_CHANGE_PASSWORD_PARAMS, oldAuthKey: INVALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        changePassword(
          db,
          brandId<AccountId>("acct_missing"),
          VALID_CHANGE_PASSWORD_PARAMS,
          mockAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws ZodError on missing required fields", async () => {
      const { db } = mockDb();

      await expect(
        changePassword(
          db,
          brandId<AccountId>("acct_123"),
          { oldAuthKey: VALID_AUTH_KEY_HEX },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("returns ok and revokedSessionCount on success", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            authKeyHash: VALID_AUTH_KEY_HASH,
            version: 1,
          },
        ])
        .mockResolvedValueOnce([{ publicKey: VALID_SIGN_PUBLIC_KEY }]);
      chain.returning
        .mockResolvedValueOnce([{ id: "acct_123" }])
        .mockResolvedValueOnce([{ id: "sess_1" }, { id: "sess_2" }, { id: "sess_3" }]);

      const result = await changePassword(
        db,
        brandId<AccountId>("acct_123"),
        VALID_CHANGE_PASSWORD_PARAMS,
        mockAudit,
      );
      expect(result).toEqual({ ok: true, revokedSessionCount: 3, sessionRevoked: true });
    });

    it("calls transaction during password change", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            authKeyHash: VALID_AUTH_KEY_HASH,
            version: 1,
          },
        ])
        .mockResolvedValueOnce([{ publicKey: VALID_SIGN_PUBLIC_KEY }]);
      chain.returning.mockResolvedValueOnce([{ id: "acct_123" }]).mockResolvedValueOnce([]);

      await changePassword(
        db,
        brandId<AccountId>("acct_123"),
        VALID_CHANGE_PASSWORD_PARAMS,
        mockAudit,
      );
      // Three transaction calls: withAccountRead (account) + withAccountRead (signing key) + withAccountTransaction (write)
      expect(chain.transaction).toHaveBeenCalledTimes(3);
    });

    it("throws on optimistic lock failure", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            authKeyHash: VALID_AUTH_KEY_HASH,
            version: 1,
          },
        ])
        .mockResolvedValueOnce([{ publicKey: VALID_SIGN_PUBLIC_KEY }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        changePassword(db, brandId<AccountId>("acct_123"), VALID_CHANGE_PASSWORD_PARAMS, mockAudit),
      ).rejects.toThrow("Account was modified concurrently");
    });

    it("throws ZodError on invalid Zod input", async () => {
      const { db } = mockDb();
      await expect(
        changePassword(db, brandId<AccountId>("acct_123"), { oldAuthKey: "" }, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("rejects when no signing key found", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            authKeyHash: VALID_AUTH_KEY_HASH,
            version: 1,
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        changePassword(db, brandId<AccountId>("acct_123"), VALID_CHANGE_PASSWORD_PARAMS, mockAudit),
      ).rejects.toThrow("No signing key found");
    });

    it("rejects with invalid challenge signature", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            authKeyHash: VALID_AUTH_KEY_HASH,
            version: 1,
          },
        ])
        .mockResolvedValueOnce([{ publicKey: VALID_SIGN_PUBLIC_KEY }]);

      vi.mocked(mockVerify).mockReturnValueOnce(false);

      await expect(
        changePassword(db, brandId<AccountId>("acct_123"), VALID_CHANGE_PASSWORD_PARAMS, mockAudit),
      ).rejects.toThrow("Invalid challenge signature");
    });
  });

  // ── updateAccountSettings ───────────────────────────────────────

  describe("updateAccountSettings", () => {
    it("returns updated settings on success", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ auditLogIpTracking: true, version: 2 }]);

      const result = await updateAccountSettings(
        db,
        brandId<AccountId>("acct_123"),
        { auditLogIpTracking: true, version: 1 },
        mockAudit,
      );
      expect(result).toEqual({ ok: true, auditLogIpTracking: true, version: 2 });
    });

    it("throws ConcurrencyError when no rows updated", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        updateAccountSettings(
          db,
          brandId<AccountId>("acct_123"),
          { auditLogIpTracking: true, version: 1 },
          mockAudit,
        ),
      ).rejects.toThrow("Account was modified concurrently");
    });

    it("throws ZodError on invalid input type", async () => {
      const { db } = mockDb();
      await expect(
        updateAccountSettings(
          db,
          brandId<AccountId>("acct_123"),
          { auditLogIpTracking: "yes" },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("throws ZodError when version is missing", async () => {
      const { db } = mockDb();
      await expect(
        updateAccountSettings(
          db,
          brandId<AccountId>("acct_123"),
          { auditLogIpTracking: true },
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("calls audit with correct detail when enabling", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ auditLogIpTracking: true, version: 2 }]);

      await updateAccountSettings(
        db,
        brandId<AccountId>("acct_123"),
        { auditLogIpTracking: true, version: 1 },
        mockAudit,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "settings.changed",
          detail: "Audit log IP tracking enabled",
          overrideTrackIp: true,
        }),
      );
    });

    it("calls audit with correct detail when disabling", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ auditLogIpTracking: false, version: 3 }]);

      await updateAccountSettings(
        db,
        brandId<AccountId>("acct_123"),
        { auditLogIpTracking: false, version: 2 },
        mockAudit,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "settings.changed",
          detail: "Audit log IP tracking disabled",
          overrideTrackIp: false,
        }),
      );
    });

    it("uses transaction", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ auditLogIpTracking: true, version: 2 }]);

      await updateAccountSettings(
        db,
        brandId<AccountId>("acct_123"),
        { auditLogIpTracking: true, version: 1 },
        mockAudit,
      );
      expect(chain.transaction).toHaveBeenCalledOnce();
    });
  });

  // ── ConcurrencyError ────────────────────────────────────────────

  describe("ConcurrencyError", () => {
    it("has name set to ConcurrencyError", () => {
      const err = new ConcurrencyError("test");
      expect(err.name).toBe("ConcurrencyError");
    });

    it("extends Error", () => {
      const err = new ConcurrencyError("test");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
