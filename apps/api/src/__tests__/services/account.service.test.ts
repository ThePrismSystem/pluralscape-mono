import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

// ── Mock external dependencies ───────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
    memzero: vi.fn(),
    genericHash: () => new Uint8Array(32),
  }),
  hashPassword: () => "$argon2id$fake$newhash",
  verifyPassword: (hash: string) => hash === "$argon2id$fake$valid",
  generateSalt: () => new Uint8Array(16),
  derivePasswordKey: () => Promise.resolve(new Uint8Array(32)),
  generateMasterKey: () => new Uint8Array(32),
  wrapMasterKey: () => ({
    ciphertext: new Uint8Array(48),
    nonce: new Uint8Array(24),
  }),
  unwrapMasterKey: () => new Uint8Array(32),
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getAccountInfo, changeEmail, changePassword, ConcurrencyError } =
  await import("../../services/account.service.js");

// ── Tests ────────────────────────────────────────────────────────────

describe("account service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const requestMeta = { ipAddress: "1.2.3.4", userAgent: "TestAgent/1.0" };

  // ── getAccountInfo ──────────────────────────────────────────────

  describe("getAccountInfo", () => {
    it("returns null when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await getAccountInfo(db, "acct_notfound");
      expect(result).toBeNull();
    });

    it("returns account info for system account with systemId", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            accountId: "acct_123",
            accountType: "system",
            createdAt: 1000,
            updatedAt: 2000,
          },
        ])
        .mockResolvedValueOnce([{ id: "sys_456" }]);

      const result = await getAccountInfo(db, "acct_123");
      expect(result).toEqual({
        accountId: "acct_123",
        accountType: "system",
        systemId: "sys_456",
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
          createdAt: 1000,
          updatedAt: 2000,
        },
      ]);

      const result = await getAccountInfo(db, "acct_789");
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
            createdAt: 1000,
            updatedAt: 2000,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await getAccountInfo(db, "acct_123");
      expect(result?.systemId).toBeNull();
    });
  });

  // ── changeEmail ─────────────────────────────────────────────────

  describe("changeEmail", () => {
    it("throws on invalid password", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$invalid",
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);

      await expect(
        changeEmail(
          db,
          "acct_123",
          { email: "new@example.com", currentPassword: "wrong" },
          requestMeta,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        changeEmail(
          db,
          "acct_missing",
          { email: "new@example.com", currentPassword: "pass" },
          requestMeta,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws when email is unchanged", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          emailHash: "hashed_same@example.com",
          version: 1,
        },
      ]);

      await expect(
        changeEmail(
          db,
          "acct_123",
          { email: "same@example.com", currentPassword: "pass" },
          requestMeta,
        ),
      ).rejects.toThrow("New email must be different");
    });

    it("returns ok on successful email change", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);
      chain.returning.mockResolvedValueOnce([{ id: "acct_123" }]);

      const result = await changeEmail(
        db,
        "acct_123",
        { email: "new@example.com", currentPassword: "pass" },
        requestMeta,
      );
      expect(result).toEqual({ ok: true });
    });

    it("throws generic error on duplicate email", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          emailHash: "hashed_old@example.com",
          version: 1,
        },
      ]);

      const pgError = new Error("duplicate key value violates unique constraint");
      Object.assign(pgError, { code: "23505", constraint_name: "accounts_email_hash_idx" });
      chain.transaction.mockRejectedValueOnce(pgError);

      await expect(
        changeEmail(
          db,
          "acct_123",
          { email: "taken@example.com", currentPassword: "pass" },
          requestMeta,
        ),
      ).rejects.toThrow("Email change failed");
    });

    it("throws on invalid email format", async () => {
      const { db } = mockDb();
      await expect(
        changeEmail(
          db,
          "acct_123",
          { email: "not-an-email", currentPassword: "pass" },
          requestMeta,
        ),
      ).rejects.toThrow();
    });

    it("uses optimistic locking via version", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          emailHash: "hashed_old@example.com",
          version: 5,
        },
      ]);
      // Optimistic lock fails — no rows updated
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        changeEmail(
          db,
          "acct_123",
          { email: "new@example.com", currentPassword: "pass" },
          requestMeta,
        ),
      ).rejects.toThrow("Account was modified concurrently");
    });
  });

  // ── changePassword ──────────────────────────────────────────────

  describe("changePassword", () => {
    const validParams = {
      currentPassword: "currentpass123",
      newPassword: "newpassword123",
    };

    it("throws on invalid current password", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$invalid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
          version: 1,
        },
      ]);

      await expect(
        changePassword(db, "acct_123", "sess_1", validParams, requestMeta),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        changePassword(db, "acct_missing", "sess_1", validParams, requestMeta),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws on too-short new password", async () => {
      const { db } = mockDb();

      await expect(
        changePassword(
          db,
          "acct_123",
          "sess_1",
          { currentPassword: "current", newPassword: "short" },
          requestMeta,
        ),
      ).rejects.toThrow(/Password must be at least/);
    });

    it("returns ok and revokedSessionCount on success", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
          version: 1,
        },
      ]);
      // First returning: account update
      chain.returning
        .mockResolvedValueOnce([{ id: "acct_123" }])
        // Second returning: session revocation
        .mockResolvedValueOnce([{ id: "sess_2" }, { id: "sess_3" }]);

      const result = await changePassword(db, "acct_123", "sess_1", validParams, requestMeta);
      expect(result).toEqual({ ok: true, revokedSessionCount: 2 });
    });

    it("calls transaction during password change", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
          version: 1,
        },
      ]);
      chain.returning.mockResolvedValueOnce([{ id: "acct_123" }]).mockResolvedValueOnce([]);

      await changePassword(db, "acct_123", "sess_1", validParams, requestMeta);
      expect(chain.transaction).toHaveBeenCalledOnce();
    });

    it("throws on optimistic lock failure", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: new Uint8Array(72),
          version: 1,
        },
      ]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        changePassword(db, "acct_123", "sess_1", validParams, requestMeta),
      ).rejects.toThrow("Account was modified concurrently");
    });

    it("throws on missing encrypted master key", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          passwordHash: "$argon2id$fake$valid",
          kdfSalt: "00".repeat(16),
          encryptedMasterKey: null,
          version: 1,
        },
      ]);

      await expect(
        changePassword(db, "acct_123", "sess_1", validParams, requestMeta),
      ).rejects.toThrow("Account missing encrypted master key");
    });

    it("throws on invalid Zod input", async () => {
      const { db } = mockDb();
      await expect(
        changePassword(
          db,
          "acct_123",
          "sess_1",
          { currentPassword: "", newPassword: "newpass123" },
          requestMeta,
        ),
      ).rejects.toThrow();
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
