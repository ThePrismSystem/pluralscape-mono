import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BiometricTokenId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  GENERIC_HASH_BYTES_MAX: 64,
  getSodium: vi.fn().mockReturnValue({
    genericHash: vi.fn().mockReturnValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
    memzero: vi.fn(),
  }),
}));

vi.mock("@pluralscape/db/pg", () => ({
  biometricTokens: {
    id: "biometricTokens.id",
    sessionId: "biometricTokens.sessionId",
    tokenHash: "biometricTokens.tokenHash",
    createdAt: "biometricTokens.createdAt",
  },
  systemSettings: {
    biometricEnabled: "systemSettings.biometricEnabled",
    systemId: "systemSettings.systemId",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    ID_PREFIXES: { biometricToken: "bt_" },
    createId: vi.fn().mockReturnValue("bt_test123"),
    now: vi.fn().mockReturnValue(1700000000000),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, op: "and" })),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { enrollBiometric, verifyBiometric } = await import("../../services/biometric.service.js");

// ── Fixtures ─────────────────────────────────────────────────────

function createAuth(overrides?: Partial<AuthContext>): AuthContext {
  return {
    accountId: "acct_abc" as AuthContext["accountId"],
    systemId: "sys_xyz" as AuthContext["systemId"],
    sessionId: "sess_001" as AuthContext["sessionId"],
    accountType: "system",
    ownedSystemIds: new Set(["sys_xyz" as AuthContext["systemId"] & string]),
    auditLogIpTracking: false,
    ...overrides,
  };
}

const VALID_ENROLL_BODY = { token: "my-biometric-token" };
const VALID_VERIFY_BODY = { token: "my-biometric-token" };

// ── enrollBiometric ──────────────────────────────────────────────

describe("enrollBiometric", () => {
  let mockAudit: AuditWriter;

  beforeEach(() => {
    mockAudit = vi.fn().mockResolvedValue(undefined) as AuditWriter;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the created token ID on success", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ biometricEnabled: true }]);

    const result = await enrollBiometric(db, VALID_ENROLL_BODY, createAuth(), mockAudit);

    expect(result).toEqual({ id: "bt_test123" as BiometricTokenId });
    expect(chain.insert).toHaveBeenCalledOnce();
  });

  it("throws VALIDATION_ERROR for invalid body", async () => {
    const { db } = mockDb();

    await expect(enrollBiometric(db, { token: "" }, createAuth(), mockAudit)).rejects.toMatchObject(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid enroll payload",
        status: 400,
      },
    );
  });

  it("throws BIOMETRIC_DISABLED when biometricEnabled is false", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ biometricEnabled: false }]);

    await expect(
      enrollBiometric(db, VALID_ENROLL_BODY, createAuth(), mockAudit),
    ).rejects.toMatchObject({
      code: "BIOMETRIC_DISABLED",
      status: 403,
    });
  });

  it("throws BIOMETRIC_DISABLED when no systemId in auth", async () => {
    const { db } = mockDb();
    const auth = createAuth({ systemId: null as AuthContext["systemId"] });

    await expect(enrollBiometric(db, VALID_ENROLL_BODY, auth, mockAudit)).rejects.toMatchObject({
      code: "BIOMETRIC_DISABLED",
      status: 403,
    });
  });

  it("audits the enrollment event", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ biometricEnabled: true }]);
    const auth = createAuth();

    await enrollBiometric(db, VALID_ENROLL_BODY, auth, mockAudit);

    expect(mockAudit).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "auth.biometric-enrolled",
        actor: { kind: "account", id: auth.accountId },
        systemId: auth.systemId,
      }),
    );
  });
});

// ── verifyBiometric ──────────────────────────────────────────────

describe("verifyBiometric", () => {
  let mockAudit: AuditWriter;

  beforeEach(() => {
    mockAudit = vi.fn().mockResolvedValue(undefined) as AuditWriter;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns verified: true on matching token", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "bt_test123" }]);

    const result = await verifyBiometric(db, VALID_VERIFY_BODY, createAuth(), mockAudit);

    expect(result).toEqual({ verified: true });
  });

  it("throws VALIDATION_ERROR for invalid body", async () => {
    const { db } = mockDb();

    await expect(verifyBiometric(db, { token: "" }, createAuth(), mockAudit)).rejects.toMatchObject(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid verify payload",
        status: 400,
      },
    );
  });

  it("throws INVALID_TOKEN when no matching token is found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      verifyBiometric(db, VALID_VERIFY_BODY, createAuth(), mockAudit),
    ).rejects.toMatchObject({
      code: "INVALID_TOKEN",
      status: 401,
    });
  });

  it("fires audit for failed biometric verification (fire-and-forget)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    const auth = createAuth();

    await expect(verifyBiometric(db, VALID_VERIFY_BODY, auth, mockAudit)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });

    expect(mockAudit).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "auth.biometric-failed",
        actor: { kind: "account", id: auth.accountId },
        systemId: auth.systemId,
      }),
    );
  });

  it("returns 401 even when audit write fails", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    const auth = createAuth();
    const failingAudit = vi.fn().mockRejectedValue(new Error("DB down")) as AuditWriter;

    await expect(verifyBiometric(db, VALID_VERIFY_BODY, auth, failingAudit)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
      status: 401,
    });
  });

  it("audits the verification event", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "bt_test123" }]);
    const auth = createAuth();

    await verifyBiometric(db, VALID_VERIFY_BODY, auth, mockAudit);

    expect(mockAudit).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "auth.biometric-verified",
        actor: { kind: "account", id: auth.accountId },
        systemId: auth.systemId,
      }),
    );
  });
});
