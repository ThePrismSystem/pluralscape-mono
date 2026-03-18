import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { extractIpAddress, extractPlatform, extractUserAgent } from "../../lib/request-meta.js";
import { CLIENT_PLATFORM_HEADER, DEFAULT_PLATFORM } from "../../routes/auth/auth.constants.js";
import {
  ValidationError,
  listSessions,
  logoutCurrentSession,
  loginAccount,
  registerAccount,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";
import { mockDb } from "../helpers/mock-db.js";

import type { Context } from "hono";

// ── Mock helpers ─────────────────────────────────────────────────────

/** Build a minimal mock Hono context with the given headers. */
function mockContext(headers: Record<string, string> = {}): Context {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    req: {
      header(name: string) {
        return headerMap.get(name.toLowerCase());
      },
    },
  } as Context;
}

// ── Mock external dependencies ───────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  GENERIC_HASH_BYTES_MAX: 64,
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
    memzero: vi.fn(),
    genericHash: () => new Uint8Array(32),
  }),
  hashPassword: () => "$argon2id$fake$hash",
  verifyPassword: (hash: string) => hash === "$argon2id$fake$valid",
  generateSalt: () => new Uint8Array(16),
  derivePasswordKey: () => Promise.resolve(new Uint8Array(32)),
  generateMasterKey: () => new Uint8Array(32),
  wrapMasterKey: () => ({
    ciphertext: new Uint8Array(48),
    nonce: new Uint8Array(24),
  }),
  generateIdentityKeypair: () => ({
    encryption: {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    },
    signing: {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(64),
    },
  }),
  encryptPrivateKey: () => ({
    ciphertext: new Uint8Array(48),
    nonce: new Uint8Array(24),
  }),
  generateRecoveryKey: () => ({
    displayKey: "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM",
    encryptedMasterKey: {
      ciphertext: new Uint8Array(48),
      nonce: new Uint8Array(24),
    },
  }),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
}));

// Mock now() so tests can control the current time
const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, now: () => mockNow() };
});

// ── Tests ────────────────────────────────────────────────────────────

describe("auth service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockNow.mockReturnValue(Date.now());
    mockAudit.mockClear();
  });
  // ── extractIpAddress ───────────────────────────────────────────────

  describe("extractIpAddress", () => {
    const originalTrustProxy = process.env["TRUST_PROXY"];

    afterEach(() => {
      if (originalTrustProxy === undefined) {
        delete process.env["TRUST_PROXY"];
      } else {
        process.env["TRUST_PROXY"] = originalTrustProxy;
      }
    });

    it("returns null when TRUST_PROXY is not set", () => {
      delete process.env["TRUST_PROXY"];
      const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY is set to something other than '1'", () => {
      process.env["TRUST_PROXY"] = "true";
      const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns the first IP from x-forwarded-for when TRUST_PROXY=1", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
      expect(extractIpAddress(c)).toBe("1.2.3.4");
    });

    it("returns a single IP from x-forwarded-for when TRUST_PROXY=1", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "10.0.0.1" });
      expect(extractIpAddress(c)).toBe("10.0.0.1");
    });

    it("trims whitespace from the extracted IP", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" });
      expect(extractIpAddress(c)).toBe("192.168.1.1");
    });

    it("returns null when TRUST_PROXY=1 but x-forwarded-for is missing", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({});
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=1 and x-forwarded-for is empty", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=1 and x-forwarded-for is not a valid IP", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "not-an-ip-address" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=1 and x-forwarded-for contains script injection", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "<script>alert(1)</script>" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("accepts valid IPv6 from x-forwarded-for when TRUST_PROXY=1", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "::1" });
      expect(extractIpAddress(c)).toBe("::1");
    });

    it("returns null when TRUST_PROXY=1 and x-forwarded-for contains only whitespace", () => {
      process.env["TRUST_PROXY"] = "1";
      const c = mockContext({ "x-forwarded-for": "   " });
      // After split(",")[0]?.trim(), result is "" which has length 0
      expect(extractIpAddress(c)).toBeNull();
    });
  });

  // ── extractUserAgent ───────────────────────────────────────────────

  describe("extractUserAgent", () => {
    it("returns the user-agent header when present", () => {
      const c = mockContext({ "user-agent": "Mozilla/5.0 TestBrowser" });
      expect(extractUserAgent(c)).toBe("Mozilla/5.0 TestBrowser");
    });

    it("returns null when user-agent header is missing", () => {
      const c = mockContext({});
      expect(extractUserAgent(c)).toBeNull();
    });

    it("returns the exact value without trimming", () => {
      const c = mockContext({ "user-agent": "  spaced-agent  " });
      expect(extractUserAgent(c)).toBe("  spaced-agent  ");
    });
  });

  // ── extractPlatform ────────────────────────────────────────────────

  describe("extractPlatform", () => {
    it("returns 'web' when header is 'web'", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "web" });
      expect(extractPlatform(c)).toBe("web");
    });

    it("returns 'mobile' when header is 'mobile'", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "mobile" });
      expect(extractPlatform(c)).toBe("mobile");
    });

    it("returns default platform when header is missing", () => {
      const c = mockContext({});
      expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
    });

    it("returns default platform for invalid header value", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "desktop" });
      expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
    });

    it("returns default platform for empty header", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "" });
      expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
    });

    it("is case-sensitive — 'Web' is not valid", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "Web" });
      expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
    });

    it("is case-sensitive — 'MOBILE' is not valid", () => {
      const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "MOBILE" });
      expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
    });
  });

  // ── ValidationError ────────────────────────────────────────────────

  describe("ValidationError", () => {
    it("has name set to 'ValidationError'", () => {
      const err = new ValidationError("test message");
      expect(err.name).toBe("ValidationError");
    });

    it("extends Error", () => {
      const err = new ValidationError("test message");
      expect(err).toBeInstanceOf(Error);
    });

    it("preserves the error message", () => {
      const err = new ValidationError("something went wrong");
      expect(err.message).toBe("something went wrong");
    });

    it("has a stack trace", () => {
      const err = new ValidationError("trace test");
      expect(err.stack).toBeDefined();
    });
  });

  // ── registerAccount ────────────────────────────────────────────────

  describe("registerAccount", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const validParams = {
      email: "test@example.com",
      password: "securepassword123",
      recoveryKeyBackupConfirmed: true,
    };
    it("throws ValidationError when recoveryKeyBackupConfirmed is false", async () => {
      const { db } = mockDb();
      await expect(
        registerAccount(
          db,
          { ...validParams, recoveryKeyBackupConfirmed: false },
          "web",
          mockAudit,
        ),
      ).rejects.toThrow("Recovery key backup must be confirmed");
    });

    it("throws ZodError for short passwords (schema-level enforcement)", async () => {
      const { db } = mockDb();
      await expect(
        registerAccount(db, { ...validParams, password: "short" }, "web", mockAudit),
      ).rejects.toThrow(expect.objectContaining({ name: "ZodError" }));
    });

    it("returns registration result on success", async () => {
      const { db } = mockDb();
      const result = await registerAccount(db, validParams, "web", mockAudit);

      expect(result).toHaveProperty("sessionToken");
      expect(result).toHaveProperty("recoveryKey");
      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("accountType");
      expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
      expect(result.accountId).toMatch(/^acct_/);
      expect(result.accountType).toBe("system");
    });

    it("uses provided accountType", async () => {
      const { db } = mockDb();
      const result = await registerAccount(
        db,
        { ...validParams, accountType: "viewer" },
        "web",
        mockAudit,
      );
      expect(result.accountType).toBe("viewer");
    });

    it("returns a recovery key in group format", async () => {
      const { db } = mockDb();
      const result = await registerAccount(db, validParams, "web", mockAudit);
      // Real recovery key is generated by the mock: "AAAA-BBBB-CCCC-..."
      expect(result.recoveryKey).toContain("-");
      expect(result.recoveryKey.split("-").length).toBeGreaterThan(1);
    });

    it("calls db.transaction during registration", async () => {
      const { db, chain } = mockDb();
      await registerAccount(db, validParams, "web", mockAudit);
      expect(chain.transaction).toHaveBeenCalledOnce();
    });

    it("returns fake result on duplicate email to prevent enumeration", async () => {
      const { db, chain } = mockDb();
      const pgError = new Error("duplicate key value violates unique constraint");
      Object.assign(pgError, {
        code: PG_UNIQUE_VIOLATION,
        constraint_name: "accounts_email_hash_idx",
      });
      chain.transaction.mockRejectedValueOnce(pgError);

      const result = await registerAccount(db, validParams, "web", mockAudit);
      // Should still return a result (anti-enumeration)
      expect(result).toHaveProperty("sessionToken");
      expect(result).toHaveProperty("recoveryKey");
      expect(result).toHaveProperty("accountId");
    });

    it("rethrows non-duplicate errors", async () => {
      const { db, chain } = mockDb();
      chain.transaction.mockRejectedValueOnce(new Error("connection refused"));

      await expect(registerAccount(db, validParams, "web", mockAudit)).rejects.toThrow(
        "connection refused",
      );
    });

    it("throws on invalid email format", async () => {
      const { db } = mockDb();
      await expect(
        registerAccount(db, { ...validParams, email: "not-an-email" }, "web", mockAudit),
      ).rejects.toThrow();
    });

    it("accepts password at exactly minimum length boundary", async () => {
      const { db } = mockDb();
      const result = await registerAccount(
        db,
        { ...validParams, password: "12345678" },
        "web",
        mockAudit,
      );
      expect(result).toHaveProperty("sessionToken");
    });

    it("generates fake recovery key with correct format for anti-enumeration", async () => {
      const { db, chain } = mockDb();
      const pgError = new Error("duplicate key value violates unique constraint");
      Object.assign(pgError, {
        code: PG_UNIQUE_VIOLATION,
        constraint_name: "accounts_email_hash_idx",
      });
      chain.transaction.mockRejectedValueOnce(pgError);

      const result = await registerAccount(db, validParams, "web", mockAudit);
      const groups = result.recoveryKey.split("-");
      expect(groups).toHaveLength(13);
      for (const group of groups) {
        expect(group).toHaveLength(4);
        expect(group).toMatch(/^[A-Z2-7]+$/);
      }
    });
  });

  // ── loginAccount ───────────────────────────────────────────────────

  describe("loginAccount", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const credentials = { email: "test@example.com", password: "securepassword123" };

    it("returns null when account is not found", async () => {
      const { db, chain } = mockDb();
      // limit() resolves to [] by default (no account found)
      chain.limit.mockResolvedValue([]);

      const result = await loginAccount(db, credentials, "web", mockAudit);
      expect(result).toBeNull();
    });

    it("returns null when password is invalid", async () => {
      const { db, chain } = mockDb();
      // First call to limit() returns an account; verifyPassword will check against this hash
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          passwordHash: "$argon2id$fake$invalid",
          accountType: "system",
        },
      ]);

      const result = await loginAccount(db, credentials, "web", mockAudit);
      expect(result).toBeNull();
    });

    it("returns login result with systemId for system accounts", async () => {
      const { db, chain } = mockDb();
      // First limit() call: account lookup
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_123",
            emailHash: "hashed_test@example.com",
            passwordHash: "$argon2id$fake$valid",
            accountType: "system",
          },
        ])
        // Second limit() call: system lookup
        .mockResolvedValueOnce([{ id: "sys_456" }]);

      const result = await loginAccount(db, credentials, "web", mockAudit);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe("acct_123");
      expect(result?.systemId).toBe("sys_456");
      expect(result?.accountType).toBe("system");
      expect(result?.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns null systemId for non-system accounts", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_789",
          emailHash: "hashed_test@example.com",
          passwordHash: "$argon2id$fake$valid",
          accountType: "caregiver",
        },
      ]);

      const result = await loginAccount(db, credentials, "web", mockAudit);

      expect(result).not.toBeNull();
      expect(result?.systemId).toBeNull();
    });

    it("inserts a new session row on successful login", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          passwordHash: "$argon2id$fake$valid",
          accountType: "caregiver",
        },
      ]);

      await loginAccount(db, credentials, "web", mockAudit);
      expect(chain.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalled();
    });

    it("throws on invalid email format", async () => {
      const { db } = mockDb();
      await expect(
        loginAccount(db, { email: "bad", password: "test" }, "web", mockAudit),
      ).rejects.toThrow();
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns empty sessions array when no rows match", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listSessions(db, "acct_123");
      expect(result.sessions).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it("returns sessions without nextCursor when under the limit", async () => {
      const { db, chain } = mockDb();
      const rows = [
        { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000 },
        { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100 },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, "acct_123");
      expect(result.sessions).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when there are more rows than the limit", async () => {
      const { db, chain } = mockDb();
      const rows = [
        { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000 },
        { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100 },
        { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200 },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, "acct_123", undefined, 2);
      expect(result.sessions).toHaveLength(2);
      expect(result.nextCursor).toBe("sess_2");
    });

    it("paginates in memory using cursor", async () => {
      const { db, chain } = mockDb();
      const rows = [
        { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000 },
        { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100 },
        { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200 },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, "acct_123", "sess_1", 2);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]?.id).toBe("sess_2");
      expect(result.sessions[1]?.id).toBe("sess_3");
      expect(result.nextCursor).toBeNull();
    });

    it("filters out idle-timed-out sessions", async () => {
      const { db, chain } = mockDb();
      const fixedTime = 700_000_000;
      mockNow.mockReturnValue(fixedTime);
      // Session with very stale lastActive — idle timeout will exclude it
      const rows = [{ id: "sess_1", createdAt: 0, lastActive: 1, expiresAt: 2_592_000_000 }];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, "acct_123");
      expect(result.sessions).toHaveLength(0);
    });

    it("includes sessions within idle window", async () => {
      const { db, chain } = mockDb();
      const fixedTime = 1_000_000;
      mockNow.mockReturnValue(fixedTime);
      const rows = [
        {
          id: "sess_1",
          createdAt: fixedTime - 1000,
          lastActive: fixedTime - 500,
          expiresAt: fixedTime + 2_592_000_000,
        },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, "acct_123");
      expect(result.sessions).toHaveLength(1);
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("returns false when session is not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_999", "acct_123", mockAudit);
      expect(result).toBe(false);
    });

    it("returns false when session belongs to a different account", async () => {
      const { db, chain } = mockDb();
      // UPDATE with accountId in WHERE matches zero rows
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_1", "acct_123", mockAudit);
      expect(result).toBe(false);
    });

    it("returns true and revokes session when actor owns it", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

      const result = await revokeSession(db, "sess_1", "acct_123", mockAudit);
      expect(result).toBe(true);
      expect(chain.transaction).toHaveBeenCalled();
    });

    it("returns false for cross-account revocation without modifying the session", async () => {
      const { db, chain } = mockDb();
      // The UPDATE should match zero rows (accountId mismatch in WHERE clause)
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_target", "acct_attacker", mockAudit);
      expect(result).toBe(false);
      // Audit should NOT be called for unauthorized attempts
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("returns false when session is already revoked", async () => {
      const { db, chain } = mockDb();
      // WHERE includes revoked = false, so already-revoked sessions match zero rows
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_1", "acct_123", mockAudit);
      expect(result).toBe(false);
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("returns 0 when no sessions are revoked", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const count = await revokeAllSessions(db, "acct_123", "sess_keep", mockAudit);
      expect(count).toBe(0);
    });

    it("returns the count of revoked sessions", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }, { id: "sess_2" }, { id: "sess_3" }]);

      const count = await revokeAllSessions(db, "acct_123", "sess_keep", mockAudit);
      expect(count).toBe(3);
    });

    it("calls update with revoked: true", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

      await revokeAllSessions(db, "acct_123", "sess_keep", mockAudit);
      expect(chain.set).toHaveBeenCalledWith({ revoked: true });
    });
  });

  // ── logoutCurrentSession ──────────────────────────────────────────

  describe("logoutCurrentSession", () => {
    it("revokes the session and returns void", async () => {
      const { db, chain } = mockDb();

      await logoutCurrentSession(db, "sess_1", "acct_123", mockAudit);
      expect(chain.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ revoked: true });
    });

    it("works with mock audit writer", async () => {
      const { db } = mockDb();

      await expect(
        logoutCurrentSession(db, "sess_1", "acct_123", mockAudit),
      ).resolves.toBeUndefined();
    });
  });
});
