/**
 * Unit tests for auth/login.ts
 *
 * Covers: loginAccount (all success/failure/throttle paths),
 * LoginThrottledError, per-account session limiting.
 */
import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

import { MAX_SESSIONS_PER_ACCOUNT } from "../../quota.constants.js";
import { LoginThrottledError, loginAccount } from "../../services/auth/login.js";
import { mockDb } from "../helpers/mock-db.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { SessionRevocation } from "./internal.js";

// ── Mock external dependencies ────────────────────────────────────────

const mockVerifyAuthKey = vi.fn<(authKey: Uint8Array, storedHash: Uint8Array) => boolean>();
mockVerifyAuthKey.mockReturnValue(true);

vi.mock("@pluralscape/crypto", () => ({
  AUTH_KEY_HASH_BYTES: 32,
  PWHASH_SALT_BYTES: 16,
  AEAD_KEY_BYTES: 32,
  AEAD_NONCE_BYTES: 24,
  GENERIC_HASH_BYTES_MAX: 64,
  assertAeadNonce: () => undefined,
  assertSignPublicKey: () => undefined,
  assertSignature: () => undefined,
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
  assertChallengeNonce: vi.fn(),
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
  verifyChallenge: vi.fn().mockReturnValue(true),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
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

const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, now: () => mockNow() };
});

// ── Fixtures ─────────────────────────────────────────────────────────

/** Valid hex string of N bytes (all zeros). */
function hexZeros(byteLen: number): string {
  return "00".repeat(byteLen);
}

/** Valid hex string of N bytes (non-zero). */
function hexFilled(byteLen: number, fill = 0xab): string {
  return fill.toString(16).padStart(2, "0").repeat(byteLen);
}

const mockAudit = vi.fn().mockResolvedValue(undefined);

const { logger: mockLogger, methods: logMethods } = createMockLogger();

const credentials = { email: "test@example.com", authKey: hexFilled(32) };

function makeAccountRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "acct_123",
    emailHash: "hashed_test@example.com",
    authKeyHash: new Uint8Array(32).fill(0xab),
    accountType: "caregiver",
    encryptedMasterKey: new Uint8Array(48),
    kdfSalt: hexZeros(16),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNow.mockReturnValue(Date.now());
  mockAudit.mockClear();
  mockVerifyAuthKey.mockClear();
  mockVerifyAuthKey.mockReturnValue(true);
  mockEqualizeAntiEnumTiming.mockClear();
  mockLoginStoreCheck.mockResolvedValue({ throttled: false, windowResetAt: Date.now() + 900_000 });
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

describe("loginAccount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
    ]);
    mockVerifyAuthKey.mockReturnValueOnce(false);

    const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(result).toBeNull();
  });

  it("returns login result with systemId for system accounts", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeAccountRow({ accountType: "system" })])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ id: "sys_456" }]);

    const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(result).not.toBeNull();
    expect(result?.accountId).toBe("acct_123");
    expect(result?.systemId).toBe("sys_456");
    expect(result?.accountType).toBe("system");
    expect(result?.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null systemId for non-system accounts", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAccountRow()]);

    const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(result).not.toBeNull();
    expect(result?.systemId).toBeNull();
  });

  it("inserts a new session row on successful login", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAccountRow()]).mockResolvedValueOnce([{ total: 0 }]);

    await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalled();
  });

  it("calls audit on invalid auth key (fire-and-forget)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
    ]);
    mockVerifyAuthKey.mockReturnValueOnce(false);
    await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
  });

  it("does not call equalizeAntiEnumTiming on successful login", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeAccountRow({ accountType: "system" })])
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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
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
      makeAccountRow({ accountType: "system", authKeyHash: new Uint8Array(32).fill(0xff) }),
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
      .mockResolvedValueOnce([makeAccountRow()])
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
      .mockResolvedValueOnce([makeAccountRow()])
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
      .mockResolvedValueOnce([makeAccountRow({ id: "acct_sys", accountType: "system" })])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    const result = await loginAccount(db, credentials, "web", mockAudit, mockLogger);
    expect(result).not.toBeNull();
    expect(result?.systemId).toBeNull();
  });

  it("skips eviction when lock query returns no oldest session (skipLocked)", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeAccountRow({ id: "acct_evict" })])
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

