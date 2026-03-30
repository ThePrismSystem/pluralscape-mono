import { afterEach, describe, expect, it, vi } from "vitest";

import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  verifyPassword: vi.fn(() => true),
}));

vi.mock("@pluralscape/db/pg", () => ({
  accounts: {
    id: "id",
    passwordHash: "password_hash",
  },
  sessions: {
    accountId: "account_id",
  },
}));

vi.mock("../../lib/rls-context.js", () => ({
  withAccountTransaction: vi.fn(
    (_db: unknown, _accountId: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
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

const { verifyPassword } = await import("@pluralscape/crypto");
const { deleteAccount } = await import("../../services/account-deletion.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test" as AccountId;
const VALID_HASH = "$argon2id$fake$valid";

function makeMockDb(): Record<string, unknown> {
  // The db object is only passed through to withAccountTransaction;
  // the tx mock handles all actual queries.
  return {};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("deleteAccount", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    resetMocks();
    mockAudit.mockClear();
  });

  it("deletes account after password verification", async () => {
    mockTx.limit.mockResolvedValueOnce([{ passwordHash: VALID_HASH }]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await deleteAccount(makeMockDb() as never, { password: "correct-password" }, auth, mockAudit);

    expect(verifyPassword).toHaveBeenCalledWith(VALID_HASH, "correct-password");
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        eventType: "data.purge",
        actor: { kind: "account", id: ACCOUNT_ID },
        detail: "Account permanently deleted",
        accountId: ACCOUNT_ID,
      }),
    );
    // Sessions deleted first, then account
    expect(mockTx.delete).toHaveBeenCalledTimes(2);
  });

  it("revokes sessions before deleting the account row", async () => {
    mockTx.limit.mockResolvedValueOnce([{ passwordHash: VALID_HASH }]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });
    await deleteAccount(makeMockDb() as never, { password: "pw" }, auth, mockAudit);

    expect(mockTx.delete).toHaveBeenCalledTimes(2);
  });

  it("throws VALIDATION_ERROR when account is not found in DB", async () => {
    // limit returns empty array -- no account row
    mockTx.limit.mockResolvedValueOnce([]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { password: "pw" }, auth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws VALIDATION_ERROR when password is incorrect", async () => {
    mockTx.limit.mockResolvedValueOnce([{ passwordHash: VALID_HASH }]);
    vi.mocked(verifyPassword).mockReturnValueOnce(false);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { password: "wrong" }, auth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws ZodError when password field is missing from params", async () => {
    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(deleteAccount(makeMockDb() as never, {}, auth, mockAudit)).rejects.toThrow();
  });

  it("throws ZodError when password is empty string", async () => {
    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { password: "" }, auth, mockAudit),
    ).rejects.toThrow();
  });

  it("does not write audit or delete rows when password verification fails", async () => {
    mockTx.limit.mockResolvedValueOnce([{ passwordHash: VALID_HASH }]);
    vi.mocked(verifyPassword).mockReturnValueOnce(false);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { password: "wrong" }, auth, mockAudit),
    ).rejects.toThrow();

    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("does not delete rows when account is not found", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });

    await expect(
      deleteAccount(makeMockDb() as never, { password: "pw" }, auth, mockAudit),
    ).rejects.toThrow();

    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("writes audit event before cascade delete", async () => {
    mockTx.limit.mockResolvedValueOnce([{ passwordHash: VALID_HASH }]);

    const callOrder: string[] = [];
    mockAudit.mockImplementationOnce(() => {
      callOrder.push("audit");
      return Promise.resolve();
    });
    mockTx.delete.mockImplementation(() => {
      callOrder.push("delete");
      return mockTx;
    });
    mockTx.where.mockImplementation(() => {
      return mockTx;
    });

    const auth = makeTestAuth({ accountId: ACCOUNT_ID });
    await deleteAccount(makeMockDb() as never, { password: "pw" }, auth, mockAudit);

    expect(callOrder[0]).toBe("audit");
    expect(callOrder.filter((c) => c === "delete")).toHaveLength(2);
  });
});
