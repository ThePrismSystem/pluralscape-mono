import { PAGINATION } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { fromCursor } from "../../lib/pagination.js";
import { extractIpAddress, extractPlatform, extractUserAgent } from "../../lib/request-meta.js";
import { MAX_SESSIONS_PER_ACCOUNT } from "../../quota.constants.js";
import {
  CLIENT_PLATFORM_HEADER,
  DEFAULT_PLATFORM,
  RECOVERY_KEY_GROUP_COUNT,
  RECOVERY_KEY_GROUP_SIZE,
} from "../../routes/auth/auth.constants.js";
import {
  LoginThrottledError,
  ValidationError,
  commitRegistration,
  generateFakeRecoveryKey,
  initiateRegistration,
  isDuplicateEmailError,
  listSessions,
  loginAccount,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";
import { mockDb } from "../helpers/mock-db.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { AccountId } from "@pluralscape/types";
import type { Context } from "hono";

const TEST_ACCOUNT_ID = "acct_123" as AccountId;
const ATTACKER_ACCOUNT_ID = "acct_attacker" as AccountId;

// ── Local test interfaces ─────────────────────────────────────────────

/** Shape of the object passed to `chain.set()` when revoking a session. */
interface SessionRevocation {
  revoked: boolean;
}

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

const mockVerifyAuthKey = vi.fn<(authKey: Uint8Array, storedHash: Uint8Array) => boolean>();
mockVerifyAuthKey.mockReturnValue(true);

const mockVerifyChallenge =
  vi.fn<(nonce: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean>();
mockVerifyChallenge.mockReturnValue(true);

vi.mock("@pluralscape/crypto", () => ({
  AUTH_KEY_HASH_BYTES: 32,
  PWHASH_SALT_BYTES: 16,
  AEAD_KEY_BYTES: 32,
  AEAD_NONCE_BYTES: 24,
  GENERIC_HASH_BYTES_MAX: 64,
  assertAeadNonce: () => undefined,
  assertSignPublicKey: () => undefined,
  assertSignature: () => undefined,
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
    memzero: vi.fn(),
    genericHash: () => new Uint8Array(32),
  }),
  generateSalt: () => new Uint8Array(16),
  generateChallengeNonce: () => new Uint8Array(32),
  hashAuthKey: (authKey: Uint8Array) => new Uint8Array(32).fill(authKey[0] ?? 0),
  verifyAuthKey: (authKey: Uint8Array, storedHash: Uint8Array) =>
    mockVerifyAuthKey(authKey, storedHash),
  verifyChallenge: (nonce: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) =>
    mockVerifyChallenge(nonce, signature, publicKey),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
}));

const mockGetEmailEncryptionKey = vi.fn<() => Uint8Array | null>();
const mockEncryptEmail = vi.fn<(email: string) => Uint8Array>();
vi.mock("../../lib/email-encrypt.js", () => ({
  getEmailEncryptionKey: () => mockGetEmailEncryptionKey(),
  encryptEmail: (email: string) => mockEncryptEmail(email),
}));

const mockLoginStoreCheck =
  vi.fn<(key: string) => Promise<{ throttled: boolean; windowResetAt: number }>>();
const mockLoginStoreRecordFailure =
  vi.fn<
    (key: string) => Promise<{ throttled: boolean; failedAttempts: number; windowResetAt: number }>
  >();
const mockLoginStoreReset = vi.fn<(key: string) => Promise<void>>();
vi.mock("../../middleware/stores/account-login-store.js", () => ({
  getAccountLoginStore: () => ({
    check: (key: string) => mockLoginStoreCheck(key),
    recordFailure: (key: string) => mockLoginStoreRecordFailure(key),
    reset: (key: string) => mockLoginStoreReset(key),
  }),
}));

const mockEqualizeAntiEnumTiming = vi.fn<(startTime: number) => Promise<void>>();
vi.mock("../../lib/anti-enum-timing.js", () => ({
  equalizeAntiEnumTiming: (startTime: number) => mockEqualizeAntiEnumTiming(startTime),
}));

// Mock now() so tests can control the current time
const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, now: () => mockNow() };
});

// ── Tests ────────────────────────────────────────────────────────────

const { logger: mockLogger, methods: logMethods } = createMockLogger();

/** Valid hex string of N bytes (all zeros). */
function hexZeros(byteLen: number): string {
  return "00".repeat(byteLen);
}

/** Valid hex string of N bytes (non-zero). */
function hexFilled(byteLen: number, fill = 0xab): string {
  return fill.toString(16).padStart(2, "0").repeat(byteLen);
}

describe("auth service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockNow.mockReturnValue(Date.now());
    mockAudit.mockClear();
    mockVerifyAuthKey.mockClear();
    mockVerifyAuthKey.mockReturnValue(true);
    mockVerifyChallenge.mockClear();
    mockVerifyChallenge.mockReturnValue(true);
    mockEqualizeAntiEnumTiming.mockClear();
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEncryptEmail.mockReturnValue(new Uint8Array(56));
    mockLoginStoreCheck.mockResolvedValue({
      throttled: false,
      windowResetAt: Date.now() + 900_000,
    });
    mockLoginStoreRecordFailure.mockResolvedValue({
      throttled: false,
      failedAttempts: 1,
      windowResetAt: Date.now() + 900_000,
    });
    mockLoginStoreReset.mockResolvedValue(undefined);
    logMethods.error.mockClear();
    logMethods.warn.mockClear();
    logMethods.info.mockClear();
    logMethods.debug.mockClear();
  });
  // ── extractIpAddress ───────────────────────────────────────────────

  describe("extractIpAddress", () => {
    afterEach(() => {
      mockEnv.TRUST_PROXY = false;
    });

    it("returns null when TRUST_PROXY is not set", () => {
      mockEnv.TRUST_PROXY = false;
      const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY is false", () => {
      mockEnv.TRUST_PROXY = false;
      const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns the first IP from x-forwarded-for when TRUST_PROXY=true", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
      expect(extractIpAddress(c)).toBe("1.2.3.4");
    });

    it("returns a single IP from x-forwarded-for when TRUST_PROXY=true", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "10.0.0.1" });
      expect(extractIpAddress(c)).toBe("10.0.0.1");
    });

    it("trims whitespace from the extracted IP", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" });
      expect(extractIpAddress(c)).toBe("192.168.1.1");
    });

    it("returns null when TRUST_PROXY=true but x-forwarded-for is missing", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({});
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=true and x-forwarded-for is empty", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=true and x-forwarded-for is not a valid IP", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "not-an-ip-address" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("returns null when TRUST_PROXY=true and x-forwarded-for contains script injection", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "<script>alert(1)</script>" });
      expect(extractIpAddress(c)).toBeNull();
    });

    it("accepts valid IPv6 from x-forwarded-for when TRUST_PROXY=true", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "::1" });
      expect(extractIpAddress(c)).toBe("::1");
    });

    it("returns null when TRUST_PROXY=true and x-forwarded-for contains only whitespace", () => {
      mockEnv.TRUST_PROXY = true;
      const c = mockContext({ "x-forwarded-for": "   " });
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

  // ── initiateRegistration ──────────────────────────────────────────

  describe("initiateRegistration", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const validParams = {
      email: "test@example.com",
    };

    it("returns accountId, kdfSalt, and challengeNonce on success", async () => {
      const { db } = mockDb();
      const result = await initiateRegistration(db, validParams);

      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("kdfSalt");
      expect(result).toHaveProperty("challengeNonce");
      expect(result.accountId).toMatch(/^acct_/);
      // kdfSalt and challengeNonce are hex-encoded
      expect(result.kdfSalt).toMatch(/^[0-9a-f]+$/);
      expect(result.challengeNonce).toMatch(/^[0-9a-f]+$/);
    });

    it("calls db.transaction during registration", async () => {
      const { db, chain } = mockDb();
      await initiateRegistration(db, validParams);
      expect(chain.transaction).toHaveBeenCalledOnce();
    });

    it("returns fake data on duplicate email to prevent enumeration", async () => {
      const { db, chain } = mockDb();
      const pgError = new Error("duplicate key value violates unique constraint");
      Object.assign(pgError, {
        code: PG_UNIQUE_VIOLATION,
        constraint_name: "accounts_email_hash_idx",
      });
      chain.transaction.mockRejectedValueOnce(pgError);

      const result = await initiateRegistration(db, validParams);
      // Should still return a result (anti-enumeration)
      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("kdfSalt");
      expect(result).toHaveProperty("challengeNonce");
    });

    it("rethrows non-duplicate errors", async () => {
      const { db, chain } = mockDb();
      chain.transaction.mockRejectedValueOnce(new Error("connection refused"));

      await expect(initiateRegistration(db, validParams)).rejects.toThrow("connection refused");
    });

    it("throws on invalid email format", async () => {
      const { db } = mockDb();
      await expect(initiateRegistration(db, { email: "not-an-email" })).rejects.toThrow();
    });

    it("calls encryptEmail when getEmailEncryptionKey returns a key", async () => {
      const fakeKey = new Uint8Array(32).fill(0xab);
      mockGetEmailEncryptionKey.mockReturnValue(fakeKey);
      mockEncryptEmail.mockReturnValue(new Uint8Array(56));
      const { db } = mockDb();
      await initiateRegistration(db, validParams);
      expect(mockEncryptEmail).toHaveBeenCalledWith("test@example.com");
    });

    it("does not call encryptEmail when getEmailEncryptionKey returns null", async () => {
      mockGetEmailEncryptionKey.mockReturnValue(null);
      mockEncryptEmail.mockClear();
      const { db } = mockDb();
      await initiateRegistration(db, validParams);
      expect(mockEncryptEmail).not.toHaveBeenCalled();
    });
  });

  // ── commitRegistration ────────────────────────────────────────────

  describe("commitRegistration", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const validCommitParams = {
      accountId: "acct_test123",
      authKey: hexFilled(32),
      encryptedMasterKey: hexFilled(48),
      encryptedSigningPrivateKey: hexFilled(48),
      encryptedEncryptionPrivateKey: hexFilled(48),
      publicSigningKey: hexFilled(32),
      publicEncryptionKey: hexFilled(32),
      recoveryEncryptedMasterKey: hexFilled(48),
      challengeSignature: hexFilled(64),
      recoveryKeyBackupConfirmed: true,
    };

    it("throws ValidationError when recoveryKeyBackupConfirmed is false", async () => {
      const { db } = mockDb();
      await expect(
        commitRegistration(
          db,
          { ...validCommitParams, recoveryKeyBackupConfirmed: false },
          "web",
          mockAudit,
        ),
      ).rejects.toThrow("Recovery key backup must be confirmed");
    });

    it("throws ValidationError when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
        "Invalid or expired registration",
      );
    });

    it("throws ValidationError when registration already completed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_test123",
          accountType: "system",
          authKeyHash: new Uint8Array(32).fill(0xff), // non-zero = completed
          challengeNonce: new Uint8Array(32),
          challengeExpiresAt: Date.now() + 300_000,
        },
      ]);
      await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
        "Registration already completed",
      );
    });

    it("throws ValidationError when challenge nonce expired", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_test123",
          accountType: "system",
          authKeyHash: new Uint8Array(32), // all zeros = placeholder
          challengeNonce: new Uint8Array(32),
          challengeExpiresAt: 1, // expired (way in the past)
        },
      ]);
      mockNow.mockReturnValue(Date.now());
      await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
        "Registration challenge expired",
      );
    });

    it("throws ValidationError when challenge signature is invalid", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_test123",
          accountType: "system",
          authKeyHash: new Uint8Array(32),
          challengeNonce: new Uint8Array(32),
          challengeExpiresAt: Date.now() + 300_000,
        },
      ]);
      mockVerifyChallenge.mockReturnValueOnce(false);
      await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
        "Invalid challenge signature",
      );
    });

    it("returns commit result on success", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_test123",
          accountType: "system",
          authKeyHash: new Uint8Array(32),
          challengeNonce: new Uint8Array(32),
          challengeExpiresAt: Date.now() + 300_000,
        },
      ]);

      const result = await commitRegistration(db, validCommitParams, "web", mockAudit);
      expect(result).toHaveProperty("sessionToken");
      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("accountType");
      expect(result.accountId).toBe("acct_test123");
      expect(result.accountType).toBe("system");
      expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── loginAccount ───────────────────────────────────────────────────

  describe("loginAccount", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const credentials = { email: "test@example.com", authKey: hexFilled(32) };

    it("returns null when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).toBeNull();
    });

    it("writes fire-and-forget audit event when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({
          eventType: "auth.login-failed",
          actor: { kind: "account", id: "acct_00000000-0000-0000-0000-000000000000" },
          detail: "Account not found",
        }),
      );
    });

    it("returns null even when email-not-found audit write fails", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);
      const auditError = new Error("audit DB down");
      mockAudit.mockRejectedValueOnce(auditError);
      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).toBeNull();
      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          "[audit] Failed to write auth.login-failed:",
          { err: auditError },
        );
      });
    });

    it("returns null when auth key is invalid", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).toBeNull();
    });

    it("returns login result with systemId for system accounts", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_123",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "system",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ id: "sys_456" }]);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe("acct_123");
      expect(result?.systemId).toBe("sys_456");
      expect(result?.accountType).toBe("system");
      expect(result?.sessionToken).toMatch(/^[0-9a-f]{64}$/);
      expect(result?.encryptedMasterKey).toBeDefined();
      expect(result?.kdfSalt).toBeDefined();
    });

    it("returns null systemId for non-system accounts", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_789",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xab),
          accountType: "caregiver",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);

      expect(result).not.toBeNull();
      expect(result?.systemId).toBeNull();
    });

    it("inserts a new session row on successful login", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xab),
          accountType: "caregiver",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(chain.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalled();
    });

    it("calls audit on invalid auth key (fire-and-forget)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).toBeNull();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "auth.login-failed" }),
      );
    });

    it("returns null even when audit write fails", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);
      mockAudit.mockRejectedValueOnce(new Error("audit DB down"));

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(logMethods.error).toHaveBeenCalledWith(
        "Failed to write auth.login-failed audit event",
        expect.objectContaining({ err: expect.any(Error) }),
      );
    });

    it("throws on invalid email format", async () => {
      const { db } = mockDb();
      await expect(
        loginAccount(db, { email: "bad", authKey: hexFilled(32) }, "web", mockAudit, mockLogger),
      ).rejects.toThrow();
    });

    it("calls equalizeAntiEnumTiming when account is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("calls equalizeAntiEnumTiming when auth key is invalid", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
    });

    it("does not call equalizeAntiEnumTiming on successful login", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_123",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "system",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ id: "sys_456" }]);
      chain.returning.mockResolvedValueOnce([{ id: "sess_new" }]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(mockEqualizeAntiEnumTiming).not.toHaveBeenCalled();
    });

    it("throws LoginThrottledError when account is throttled", async () => {
      const { db } = mockDb();
      mockLoginStoreCheck.mockResolvedValueOnce({
        throttled: true,
        windowResetAt: 1_700_000_000_000,
      });

      await expect(loginAccount(db, credentials, "web", mockAudit, mockLogger)).rejects.toThrow(
        LoginThrottledError,
      );
    });

    it("logs error when recordFailure throws in not-found path (Error instance)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);
      mockLoginStoreRecordFailure.mockRejectedValueOnce(new Error("valkey down"));

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(logMethods.error).toHaveBeenCalledWith("Failed to record login failure for throttle", {
        err: expect.any(Error),
      });
    });

    it("logs error when recordFailure throws in not-found path (non-Error)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);
      mockLoginStoreRecordFailure.mockRejectedValueOnce("valkey-string");

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(logMethods.error).toHaveBeenCalledWith("Failed to record login failure for throttle", {
        error: "valkey-string",
      });
    });

    it("logs non-Error audit failure in not-found path", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([]);
      mockAudit.mockRejectedValueOnce("non-error-audit");

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          "[audit] Failed to write auth.login-failed:",
          { err: { message: "non-error-audit" } },
        );
      });
    });

    it("logs error when recordFailure throws in wrong-auth-key path (Error instance)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);
      mockLoginStoreRecordFailure.mockRejectedValueOnce(new Error("valkey down"));

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(logMethods.error).toHaveBeenCalledWith("Failed to record login failure for throttle", {
        err: expect.any(Error),
      });
    });

    it("logs error when recordFailure throws in wrong-auth-key path (non-Error)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);
      mockLoginStoreRecordFailure.mockRejectedValueOnce(42);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(logMethods.error).toHaveBeenCalledWith("Failed to record login failure for throttle", {
        error: "42",
      });
    });

    it("logs String(err) when audit rejects with non-Error in wrong-auth-key path", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        {
          id: "acct_123",
          emailHash: "hashed_test@example.com",
          authKeyHash: new Uint8Array(32).fill(0xff),
          accountType: "system",
          encryptedMasterKey: new Uint8Array(48),
          kdfSalt: hexZeros(16),
        },
      ]);
      mockVerifyAuthKey.mockReturnValueOnce(false);
      mockAudit.mockRejectedValueOnce("string-audit-err");

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          "Failed to write auth.login-failed audit event",
          { error: "string-audit-err" },
        );
      });
    });

    it("logs error when throttle reset throws after successful login (Error)", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_123",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }]);
      mockLoginStoreReset.mockRejectedValueOnce(new Error("valkey reset fail"));

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).not.toBeNull();
      expect(logMethods.error).toHaveBeenCalledWith(
        "Failed to reset login throttle after successful login",
        { err: expect.any(Error) },
      );
    });

    it("logs error when throttle reset throws after successful login (non-Error)", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_123",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }]);
      mockLoginStoreReset.mockRejectedValueOnce("reset-string");

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).not.toBeNull();
      expect(logMethods.error).toHaveBeenCalledWith(
        "Failed to reset login throttle after successful login",
        { error: "reset-string" },
      );
    });

    it("returns null systemId when system lookup returns empty for system account", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_sys",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "system",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).not.toBeNull();
      expect(result?.systemId).toBeNull();
    });

    it("skips eviction when lock query returns no oldest session (skipLocked)", async () => {
      const { db, chain } = mockDb();
      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_evict",
            emailHash: "hashed_test@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: MAX_SESSIONS_PER_ACCOUNT }])
        .mockResolvedValueOnce([]);

      const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
      expect(result).not.toBeNull();
      const setCalls = chain.set.mock.calls;
      const revocationCall = setCalls.find(
        (call) => call[0] && typeof call[0] === "object" && (call[0] as SessionRevocation).revoked,
      );
      expect(revocationCall).toBeUndefined();
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns empty sessions array when no rows match", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listSessions(db, TEST_ACCOUNT_ID);
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

      const result = await listSessions(db, TEST_ACCOUNT_ID);
      expect(result.sessions).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when limit+1 rows are returned", async () => {
      const { db, chain } = mockDb();
      const rows = [
        { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000 },
        { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100 },
        { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200 },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, TEST_ACCOUNT_ID, undefined, 2);
      expect(result.sessions).toHaveLength(2);
      const { nextCursor } = result;
      expect(nextCursor).not.toBeNull();
      if (nextCursor) {
        expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("sess_2");
      }
    });

    it("passes cursor as SQL condition (not in-memory filtering)", async () => {
      const { db, chain } = mockDb();
      const rows = [
        { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100 },
        { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200 },
      ];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, TEST_ACCOUNT_ID, "sess_1", 25);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]?.id).toBe("sess_2");
      expect(result.sessions[1]?.id).toBe("sess_3");
      expect(result.nextCursor).toBeNull();
      expect(chain.where).toHaveBeenCalled();
    });

    it("all mock-returned rows appear in output (no JS-level idle filtering)", async () => {
      const { db, chain } = mockDb();
      const fixedTime = 700_000_000;
      mockNow.mockReturnValue(fixedTime);
      const rows = [{ id: "sess_1", createdAt: 0, lastActive: 1, expiresAt: 2_592_000_000 }];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listSessions(db, TEST_ACCOUNT_ID);
      expect(result.sessions).toHaveLength(1);
    });

    it("includes sessions returned by database without post-filtering", async () => {
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

      const result = await listSessions(db, TEST_ACCOUNT_ID);
      expect(result.sessions).toHaveLength(1);
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("returns false when session is not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_999", TEST_ACCOUNT_ID, mockAudit);
      expect(result).toBe(false);
    });

    it("returns false when session belongs to a different account", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_1", TEST_ACCOUNT_ID, mockAudit);
      expect(result).toBe(false);
    });

    it("returns true and revokes session when actor owns it", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

      const result = await revokeSession(db, "sess_1", TEST_ACCOUNT_ID, mockAudit);
      expect(result).toBe(true);
      expect(chain.transaction).toHaveBeenCalled();
    });

    it("returns false for cross-account revocation without modifying the session", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_target", ATTACKER_ACCOUNT_ID, mockAudit);
      expect(result).toBe(false);
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("returns false when session is already revoked", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const result = await revokeSession(db, "sess_1", TEST_ACCOUNT_ID, mockAudit);
      expect(result).toBe(false);
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("returns 0 when no sessions are revoked", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const count = await revokeAllSessions(db, TEST_ACCOUNT_ID, "sess_keep", mockAudit);
      expect(count).toBe(0);
    });

    it("returns the count of revoked sessions", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }, { id: "sess_2" }, { id: "sess_3" }]);

      const count = await revokeAllSessions(db, TEST_ACCOUNT_ID, "sess_keep", mockAudit);
      expect(count).toBe(3);
    });

    it("calls update with revoked: true", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

      await revokeAllSessions(db, TEST_ACCOUNT_ID, "sess_keep", mockAudit);
      expect(chain.set).toHaveBeenCalledWith({ revoked: true });
    });
  });

  // ── logoutCurrentSession ──────────────────────────────────────────

  describe("logoutCurrentSession", () => {
    it("revokes the session and returns void", async () => {
      const { db, chain } = mockDb();

      await logoutCurrentSession(db, "sess_1", TEST_ACCOUNT_ID, mockAudit);
      expect(chain.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ revoked: true });
    });

    it("works with mock audit writer", async () => {
      const { db } = mockDb();

      await expect(
        logoutCurrentSession(db, "sess_1", TEST_ACCOUNT_ID, mockAudit),
      ).resolves.toBeUndefined();
    });
  });

  // ── Per-account session limiting ───────────────────────────────────

  describe("loginAccount — per-account session limiting", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const credentials = { email: "session-limit@example.com", authKey: hexFilled(32) };

    it("does not evict sessions when count is below MAX_SESSIONS_PER_ACCOUNT", async () => {
      const { db, chain } = mockDb();

      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_sess_limit_low",
            emailHash: "hashed_session-limit@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 10 }]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);

      const setCalls = chain.set.mock.calls;
      const revocationCall = setCalls.find(
        (call) => call[0] && typeof call[0] === "object" && (call[0] as SessionRevocation).revoked,
      );
      expect(revocationCall).toBeUndefined();
    });

    it("evicts oldest session when count reaches MAX_SESSIONS_PER_ACCOUNT", async () => {
      const { db, chain } = mockDb();

      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_sess_limit_full",
            emailHash: "hashed_session-limit@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: MAX_SESSIONS_PER_ACCOUNT }])
        .mockResolvedValueOnce([{ id: "sess_oldest" }]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);

      expect(chain.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ revoked: true });
    });

    it("handles zero active sessions gracefully (no eviction)", async () => {
      const { db, chain } = mockDb();

      chain.limit
        .mockResolvedValueOnce([
          {
            id: "acct_sess_limit_zero",
            emailHash: "hashed_session-limit@example.com",
            authKeyHash: new Uint8Array(32).fill(0xab),
            accountType: "caregiver",
            encryptedMasterKey: new Uint8Array(48),
            kdfSalt: hexZeros(16),
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }]);

      await loginAccount(db, credentials, "web", mockAudit, mockLogger);

      const setCalls = chain.set.mock.calls;
      const revocationCall = setCalls.find(
        (call) => call[0] && typeof call[0] === "object" && (call[0] as SessionRevocation).revoked,
      );
      expect(revocationCall).toBeUndefined();
    });
  });

  // ── generateFakeRecoveryKey format ──────────────────────────────────

  describe("generateFakeRecoveryKey format", () => {
    it("fake recovery key has exactly RECOVERY_KEY_GROUP_COUNT groups", () => {
      const key = generateFakeRecoveryKey();
      const groups = key.split("-");
      expect(groups).toHaveLength(RECOVERY_KEY_GROUP_COUNT);
    });

    it("each group has exactly RECOVERY_KEY_GROUP_SIZE characters", () => {
      const key = generateFakeRecoveryKey();
      const groups = key.split("-");
      for (const group of groups) {
        expect(group).toHaveLength(RECOVERY_KEY_GROUP_SIZE);
      }
    });

    it("each group uses only base32 alphabet (A-Z, 2-7)", () => {
      const key = generateFakeRecoveryKey();
      const groups = key.split("-");
      for (const group of groups) {
        expect(group).toMatch(/^[A-Z2-7]+$/);
      }
    });
  });
});

// ── isDuplicateEmailError ───────────────────────────────────────────

describe("isDuplicateEmailError", () => {
  it("returns false for non-Error objects that are not unique violations", () => {
    expect(isDuplicateEmailError("string-error")).toBe(false);
    expect(isDuplicateEmailError(42)).toBe(false);
    expect(isDuplicateEmailError(null)).toBe(false);
  });

  it("returns false for non-Error objects (isPgErrorCode requires Error)", () => {
    const fakeError = { code: PG_UNIQUE_VIOLATION, constraint_name: "accounts_email_hash_idx" };
    expect(isDuplicateEmailError(fakeError)).toBe(false);
  });

  it("returns true when constraint_name is directly on the Error", () => {
    const err = new Error("duplicate key value violates unique constraint");
    Object.assign(err, { code: PG_UNIQUE_VIOLATION, constraint_name: "accounts_email_hash_idx" });
    expect(isDuplicateEmailError(err)).toBe(true);
  });

  it("returns true when constraint_name is on error.cause (DrizzleQueryError wrapper)", () => {
    const inner = new Error("driver error");
    Object.assign(inner, { code: PG_UNIQUE_VIOLATION, constraint_name: "accounts_email_hash_idx" });
    const outer = new Error("query failed");
    Object.assign(outer, { code: PG_UNIQUE_VIOLATION, cause: inner });
    expect(isDuplicateEmailError(outer)).toBe(true);
  });

  it("returns false when constraint_name does not match", () => {
    const err = new Error("duplicate key");
    Object.assign(err, { code: PG_UNIQUE_VIOLATION, constraint_name: "other_constraint" });
    expect(isDuplicateEmailError(err)).toBe(false);
  });
});

// ── LoginThrottledError ─────────────────────────────────────────────

describe("LoginThrottledError", () => {
  it("has name set to LoginThrottledError", () => {
    const err = new LoginThrottledError(1000);
    expect(err.name).toBe("LoginThrottledError");
  });

  it("exposes windowResetAt as UnixMillis", () => {
    const err = new LoginThrottledError(1_700_000_000_000);
    expect(err.windowResetAt).toBe(1_700_000_000_000);
  });

  it("has the expected error message", () => {
    const err = new LoginThrottledError(1000);
    expect(err.message).toBe("Too many failed login attempts");
  });

  it("extends Error", () => {
    const err = new LoginThrottledError(1000);
    expect(err).toBeInstanceOf(Error);
  });
});
