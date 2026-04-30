/**
 * Unit tests for auth/login.ts — per-account session limiting and LoginThrottledError.
 *
 * Split from login.test.ts to keep both files under the 500-LOC cap.
 */
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

// ── Mock external dependencies (mirrors login.test.ts) ────────────────

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
  getSodium: () => ({ randomBytes: (n: number) => new Uint8Array(n), memzero: vi.fn(), genericHash: () => new Uint8Array(32) }),
  generateSalt: () => new Uint8Array(16),
  generateChallengeNonce: () => new Uint8Array(32),
  hashAuthKey: (authKey: Uint8Array) => new Uint8Array(32).fill(authKey[0] ?? 0),
  verifyAuthKey: (authKey: Uint8Array, storedHash: Uint8Array) => mockVerifyAuthKey(authKey, storedHash),
  verifyChallenge: vi.fn().mockReturnValue(true),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/email-hash.js", () => ({
  hashEmail: (email: string) => `hashed_${email.toLowerCase().trim()}`,
}));

const mockLoginStoreCheck = vi.fn<(key: string) => Promise<{ throttled: boolean; windowResetAt: number }>>();
const mockLoginStoreRecordFailure = vi.fn<(key: string) => Promise<{ throttled: boolean; failedAttempts: number; windowResetAt: number }>>();
const mockLoginStoreReset = vi.fn<(key: string) => Promise<void>>();
vi.mock("../../middleware/stores/account-login-store.js", () => ({
  getAccountLoginStore: () => ({
    check: (key: string) => mockLoginStoreCheck(key),
    recordFailure: (key: string) => mockLoginStoreRecordFailure(key),
    reset: (key: string) => mockLoginStoreReset(key),
  }),
}));

vi.mock("../../lib/anti-enum-timing.js", () => ({
  equalizeAntiEnumTiming: vi.fn().mockResolvedValue(undefined),
}));

const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, now: () => mockNow() };
});

// ── Fixtures ─────────────────────────────────────────────────────────

function hexFilled(byteLen: number, fill = 0xab): string {
  return fill.toString(16).padStart(2, "0").repeat(byteLen);
}

function hexZeros(byteLen: number): string {
  return "00".repeat(byteLen);
}

const mockAudit = vi.fn().mockResolvedValue(undefined);
const { logger: mockLogger } = createMockLogger();

const sessionCreds = { email: "session-limit@example.com", authKey: hexFilled(32) };

function makeSessionLimitRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "acct_sess_limit",
    emailHash: "hashed_session-limit@example.com",
    authKeyHash: new Uint8Array(32).fill(0xab),
    accountType: "caregiver",
    encryptedMasterKey: new Uint8Array(48),
    kdfSalt: hexZeros(16),
    ...overrides,
  };
}

beforeEach(() => {
  mockNow.mockReturnValue(Date.now());
  mockAudit.mockClear();
  mockVerifyAuthKey.mockReturnValue(true);
  mockLoginStoreCheck.mockResolvedValue({ throttled: false, windowResetAt: Date.now() + 900_000 });
  mockLoginStoreRecordFailure.mockResolvedValue({ throttled: false, failedAttempts: 1, windowResetAt: Date.now() + 900_000 });
  mockLoginStoreReset.mockResolvedValue(undefined);
});

// ── Per-account session limiting ──────────────────────────────────────

describe("loginAccount — per-account session limiting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not evict sessions when count is below MAX_SESSIONS_PER_ACCOUNT", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeSessionLimitRow({ id: "acct_sess_limit_low" })])
      .mockResolvedValueOnce([{ total: 10 }]);

    await loginAccount(db, sessionCreds, "web", mockAudit, mockLogger);

    const setCalls = chain.set.mock.calls;
    const revocationCall = setCalls.find(
      (call) => call[0] && typeof call[0] === "object" && (call[0] as SessionRevocation).revoked,
    );
    expect(revocationCall).toBeUndefined();
  });

  it("evicts oldest session when count reaches MAX_SESSIONS_PER_ACCOUNT", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeSessionLimitRow({ id: "acct_sess_limit_full" })])
      .mockResolvedValueOnce([{ total: MAX_SESSIONS_PER_ACCOUNT }])
      .mockResolvedValueOnce([{ id: "sess_oldest" }]);

    await loginAccount(db, sessionCreds, "web", mockAudit, mockLogger);

    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith({ revoked: true });
  });

  it("handles zero active sessions gracefully (no eviction)", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeSessionLimitRow({ id: "acct_sess_limit_zero" })])
      .mockResolvedValueOnce([{ total: 0 }]);

    await loginAccount(db, sessionCreds, "web", mockAudit, mockLogger);

    const setCalls = chain.set.mock.calls;
    const revocationCall = setCalls.find(
      (call) => call[0] && typeof call[0] === "object" && (call[0] as SessionRevocation).revoked,
    );
    expect(revocationCall).toBeUndefined();
  });
});

// ── LoginThrottledError ───────────────────────────────────────────────

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
