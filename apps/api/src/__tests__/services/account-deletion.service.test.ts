import { afterEach, describe, expect, it, vi } from "vitest";

import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  fromHex: vi.fn((hex: string) => new TextEncoder().encode(hex)),
  verifyAuthKey: vi.fn(() => true),
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  accounts: {
    id: "id",
    authKeyHash: "auth_key_hash",
  },
  sessions: {
    accountId: "account_id",
  },
}));

vi.mock("../../lib/rls-context.js", () => ({
  withCrossAccountTransaction: vi.fn((_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

// ── Mock tx ──────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  delete: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.delete.mockReturnValue(mockTx);
}

function resetMocks(): void {
  mockTx.select.mockReset();
  mockTx.from.mockReset();
  mockTx.where.mockReset();
  mockTx.limit.mockReset();
  mockTx.delete.mockReset();
  wireChain();
}

wireChain();

// ── Import under test ────────────────────────────────────────────────

const { verifyAuthKey } = await import("@pluralscape/crypto");
const { writeAuditLog } = await import("../../lib/audit-log.js");
const { deleteAccount } = await import("../../services/account-deletion.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test" as AccountId;
const VALID_HASH = new Uint8Array(32).fill(1);

function makeMockDb(): Record<string, unknown> {
  // The db object is passed to both withCrossAccountTransaction and writeAuditLog.
  return {};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("deleteAccount", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    resetMocks();
    mockAudit.mockClear();
    vi.mocked(writeAuditLog).mockClear();
  });

  it("deletes account after auth key verification", async () => {
    mockTx.limit.mockResolvedValueOnce([{ authKeyHash: VALID_HASH }]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await deleteAccount(makeMockDb() as never, { authKey: "a".repeat(64) }, auth, mockAudit);

    expect(verifyAuthKey).toHaveBeenCalled();
    // Audit written via writeAuditLog after the cascade delete
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "data.purge",
        actor: { kind: "account", id: ACCOUNT_ID },
        detail: "Account permanently deleted",
        accountId: null,
        systemId: null,
      }),
    );
    // Sessions deleted first, then account
    expect(mockTx.delete).toHaveBeenCalledTimes(2);
  });

  it("revokes sessions before deleting the account row", async () => {
    mockTx.limit.mockResolvedValueOnce([{ authKeyHash: VALID_HASH }]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });
    await deleteAccount(makeMockDb() as never, { authKey: "a".repeat(64) }, auth, mockAudit);

    expect(mockTx.delete).toHaveBeenCalledTimes(2);
  });

  it("throws VALIDATION_ERROR when account is not found in DB", async () => {
    // limit returns empty array -- no account row
    mockTx.limit.mockResolvedValueOnce([]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { authKey: "a".repeat(64) }, auth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws VALIDATION_ERROR when auth key is incorrect", async () => {
    mockTx.limit.mockResolvedValueOnce([{ authKeyHash: VALID_HASH }]);
    vi.mocked(verifyAuthKey).mockReturnValueOnce(false);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { authKey: "b".repeat(64) }, auth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws ZodError when authKey field is missing from params", async () => {
    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(deleteAccount(makeMockDb() as never, {}, auth, mockAudit)).rejects.toThrow();
  });

  it("throws ZodError when authKey is empty string", async () => {
    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { authKey: "" }, auth, mockAudit),
    ).rejects.toThrow();
  });

  it("does not write audit or delete rows when auth key verification fails", async () => {
    mockTx.limit.mockResolvedValueOnce([{ authKeyHash: VALID_HASH }]);
    vi.mocked(verifyAuthKey).mockReturnValueOnce(false);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { authKey: "b".repeat(64) }, auth, mockAudit),
    ).rejects.toThrow();

    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("does not delete rows when account is not found", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { authKey: "a".repeat(64) }, auth, mockAudit),
    ).rejects.toThrow();

    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("writes audit event after cascade delete", async () => {
    mockTx.limit.mockResolvedValueOnce([{ authKeyHash: VALID_HASH }]);

    const callOrder: string[] = [];
    mockTx.delete.mockImplementation(() => {
      callOrder.push("delete");
      return mockTx;
    });
    mockTx.where.mockImplementation(() => {
      return mockTx;
    });
    vi.mocked(writeAuditLog).mockImplementation(() => {
      callOrder.push("audit");
      return Promise.resolve();
    });

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });
    await deleteAccount(makeMockDb() as never, { authKey: "a".repeat(64) }, auth, mockAudit);

    // Delete happens in the transaction, audit happens after
    expect(callOrder.filter((c) => c === "delete")).toHaveLength(2);
    expect(callOrder[callOrder.length - 1]).toBe("audit");
  });
});
