/**
 * Unit tests for auth/register.ts
 *
 * Covers: initiateRegistration, commitRegistration, cleanupExpiredRegistrations,
 * ValidationError, isDuplicateEmailError helpers.
 */
import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import {
  ValidationError,
  commitRegistration,
  initiateRegistration,
  isDuplicateEmailError,
} from "../../services/auth/register.js";
import { mockDb, type MockChain } from "../helpers/mock-db.js";

import type { AccountId } from "@pluralscape/types";

// ── Mock external dependencies ────────────────────────────────────────

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
  verifyAuthKey: vi.fn().mockReturnValue(true),
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
  recoveryKeyHash: hexFilled(32),
};

// ── ValidationError ───────────────────────────────────────────────────

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
    expect(typeof err.stack).toBe("string");
  });
});

// ── initiateRegistration ──────────────────────────────────────────────

describe("initiateRegistration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validParams = {
    email: "test@example.com",
    accountType: "system" as const,
  };

  it("returns accountId, kdfSalt, and challengeNonce on success", async () => {
    const { db } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEncryptEmail.mockReturnValue(new Uint8Array(56));
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const result = await initiateRegistration(db, validParams);

    expect(result).toHaveProperty("accountId");
    expect(result).toHaveProperty("kdfSalt");
    expect(result).toHaveProperty("challengeNonce");
    expect(result.accountId).toMatch(/^acct_/);
    expect(result.kdfSalt).toMatch(/^[0-9a-f]+$/);
    expect(result.challengeNonce).toMatch(/^[0-9a-f]+$/);
  });

  it("calls db.transaction during registration", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    await initiateRegistration(db, validParams);
    expect(chain.transaction).toHaveBeenCalledOnce();
  });

  it("returns fake data on duplicate email to prevent enumeration", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const pgError = new Error("duplicate key value violates unique constraint");
    Object.assign(pgError, {
      code: PG_UNIQUE_VIOLATION,
      constraint_name: "accounts_email_hash_idx",
    });
    chain.transaction.mockRejectedValueOnce(pgError);

    const result = await initiateRegistration(db, validParams);
    expect(result).toHaveProperty("accountId");
    expect(result).toHaveProperty("kdfSalt");
    expect(result).toHaveProperty("challengeNonce");
  });

  it("rethrows non-duplicate errors", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    chain.transaction.mockRejectedValueOnce(new Error("connection refused"));

    await expect(initiateRegistration(db, validParams)).rejects.toThrow("connection refused");
  });

  it("calls encryptEmail when getEmailEncryptionKey returns a key", async () => {
    const fakeKey = new Uint8Array(32).fill(0xab);
    mockGetEmailEncryptionKey.mockReturnValue(fakeKey);
    mockEncryptEmail.mockReturnValue(new Uint8Array(56));
    mockNow.mockReturnValue(Date.now());
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const { db } = mockDb();
    await initiateRegistration(db, validParams);
    expect(mockEncryptEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("does not call encryptEmail when getEmailEncryptionKey returns null", async () => {
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEncryptEmail.mockClear();
    mockNow.mockReturnValue(Date.now());
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const { db } = mockDb();
    await initiateRegistration(db, validParams);
    expect(mockEncryptEmail).not.toHaveBeenCalled();
  });

  it("deletes abandoned placeholder and retries on duplicate email", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const pgError = new Error("duplicate key value violates unique constraint");
    Object.assign(pgError, {
      code: PG_UNIQUE_VIOLATION,
      constraint_name: "accounts_email_hash_idx",
    });

    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_abandoned",
        authKeyHash: new Uint8Array(32),
        challengeExpiresAt: Date.now() - 60_000,
      },
    ]);

    let txCallCount = 0;
    chain.transaction = vi.fn<(fn: (tx: MockChain) => Promise<void>) => Promise<void>>((fn) => {
      txCallCount++;
      if (txCallCount === 1) return Promise.reject(pgError);
      return fn(chain);
    });

    const result = await initiateRegistration(db, validParams);
    expect(result).toHaveProperty("accountId");
    expect(chain.delete).toHaveBeenCalled();
    expect(txCallCount).toBe(2);
  });

  it("returns fake data when placeholder exists but is not expired", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const pgError = new Error("duplicate key value violates unique constraint");
    Object.assign(pgError, {
      code: PG_UNIQUE_VIOLATION,
      constraint_name: "accounts_email_hash_idx",
    });
    chain.transaction.mockRejectedValueOnce(pgError);
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_pending",
        authKeyHash: new Uint8Array(32),
        challengeExpiresAt: Date.now() + 300_000,
      },
    ]);

    const result = await initiateRegistration(db, validParams);
    expect(result).toHaveProperty("accountId");
    expect(chain.delete).not.toHaveBeenCalled();
    expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
  });

  it("returns fake data when existing account is fully registered", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    const pgError = new Error("duplicate key value violates unique constraint");
    Object.assign(pgError, {
      code: PG_UNIQUE_VIOLATION,
      constraint_name: "accounts_email_hash_idx",
    });
    chain.transaction.mockRejectedValueOnce(pgError);
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_real",
        authKeyHash: new Uint8Array(32).fill(0xff),
        challengeExpiresAt: null,
      },
    ]);

    const result = await initiateRegistration(db, validParams);
    expect(result).toHaveProperty("accountId");
    expect(chain.delete).not.toHaveBeenCalled();
    expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
  });

  it("calls equalizeAntiEnumTiming on success path", async () => {
    const { db } = mockDb();
    mockNow.mockReturnValue(Date.now());
    mockGetEmailEncryptionKey.mockReturnValue(null);
    mockEqualizeAntiEnumTiming.mockResolvedValue(undefined);
    await initiateRegistration(db, validParams);
    expect(mockEqualizeAntiEnumTiming).toHaveBeenCalledOnce();
  });
});

// ── commitRegistration ────────────────────────────────────────────────

describe("commitRegistration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ValidationError when recoveryKeyBackupConfirmed is false", async () => {
    const { db } = mockDb();
    mockNow.mockReturnValue(Date.now());
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
    mockNow.mockReturnValue(Date.now());
    chain.limit.mockResolvedValueOnce([]);
    await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
      "Invalid or expired registration",
    );
  });

  it("throws ValidationError when registration already completed", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_test123",
        accountType: "system",
        authKeyHash: new Uint8Array(32).fill(0xff),
        challengeNonce: new Uint8Array(32),
        challengeExpiresAt: Date.now() + 300_000,
      },
    ]);
    await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
      "Invalid or expired registration",
    );
  });

  it("throws ValidationError when challenge nonce expired", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_test123",
        accountType: "system",
        authKeyHash: new Uint8Array(32),
        challengeNonce: new Uint8Array(32),
        challengeExpiresAt: 1,
      },
    ]);
    await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
      "Invalid or expired registration",
    );
  });

  it("throws ValidationError when challenge signature is invalid", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
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
      "Invalid or expired registration",
    );
  });

  it("returns commit result on success", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_test123",
        accountType: "system",
        authKeyHash: new Uint8Array(32),
        challengeNonce: new Uint8Array(32),
        challengeExpiresAt: Date.now() + 300_000,
      },
    ]);
    chain.returning.mockResolvedValueOnce([{ id: "acct_test123" }]);

    const result = await commitRegistration(db, validCommitParams, "web", mockAudit);
    expect(result).toHaveProperty("sessionToken");
    expect(result).toHaveProperty("accountId");
    expect(result).toHaveProperty("accountType");
    expect(result.accountId).toBe("acct_test123");
    expect(result.accountType).toBe("system");
    expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws ValidationError on TOCTOU race (concurrent commit)", async () => {
    const { db, chain } = mockDb();
    mockNow.mockReturnValue(Date.now());
    chain.limit.mockResolvedValueOnce([
      {
        id: "acct_test123",
        accountType: "system",
        authKeyHash: new Uint8Array(32),
        challengeNonce: new Uint8Array(32),
        challengeExpiresAt: Date.now() + 300_000,
      },
    ]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(commitRegistration(db, validCommitParams, "web", mockAudit)).rejects.toThrow(
      "Invalid or expired registration",
    );
  });
});

// ── cleanupExpiredRegistrations ───────────────────────────────────────

describe("cleanupExpiredRegistrations", () => {
  it("returns count of deleted abandoned placeholders", async () => {
    const { db, chain } = mockDb();
    const { cleanupExpiredRegistrations } = await import("../../services/auth/cleanup.js");
    chain.returning.mockResolvedValueOnce([{ id: "acct_1" }, { id: "acct_2" }]);

    const count = await cleanupExpiredRegistrations(db);
    expect(count).toBe(2);
    expect(chain.delete).toHaveBeenCalled();
  });

  it("returns 0 when no expired placeholders exist", async () => {
    const { db, chain } = mockDb();
    const { cleanupExpiredRegistrations } = await import("../../services/auth/cleanup.js");
    chain.returning.mockResolvedValueOnce([]);

    const count = await cleanupExpiredRegistrations(db);
    expect(count).toBe(0);
  });
});

// ── isDuplicateEmailError ─────────────────────────────────────────────

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
