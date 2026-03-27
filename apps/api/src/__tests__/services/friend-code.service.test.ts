import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId, FriendCodeId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { generateFriendCode, listFriendCodes, archiveFriendCode, redeemFriendCode } =
  await import("../../services/friend-code.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test-account" as AccountId;
const OTHER_ACCOUNT_ID = "acct_other" as AccountId;
const CODE_ID = "frc_test-code" as FriendCodeId;

const AUTH = makeTestAuth({
  accountId: ACCOUNT_ID,
  systemId: "sys_test-system",
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeFriendCodeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CODE_ID,
    accountId: ACCOUNT_ID,
    code: "ABCD-EFGH",
    createdAt: 1000,
    expiresAt: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("generateFriendCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("generates a friend code with frc_ prefix and XXXX-XXXX format", async () => {
    const { db, chain } = mockDb();
    // Quota check: select().from().where().for("update") is terminal
    chain.for.mockResolvedValueOnce([{ count: 0 }]);
    // Insert returning
    chain.returning.mockResolvedValueOnce([makeFriendCodeRow()]);

    const result = await generateFriendCode(db, ACCOUNT_ID, AUTH, mockAudit);

    expect(result.id).toMatch(/^frc_/);
    expect(result.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("throws QUOTA_EXCEEDED when account has max codes", async () => {
    const { db, chain } = mockDb();
    // Quota check: .for("update") returns locked rows; code checks .length
    chain.for.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({ id: `frc_${String(i)}` })),
    );

    await expect(generateFriendCode(db, ACCOUNT_ID, AUTH, mockAudit)).rejects.toThrow(
      "Maximum of 10 friend codes per account",
    );
  });

  it("throws when insert returns no rows", async () => {
    const { db, chain } = mockDb();
    // Quota check: .for("update") returns locked rows (empty = under quota)
    chain.for.mockResolvedValueOnce([]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(generateFriendCode(db, ACCOUNT_ID, AUTH, mockAudit)).rejects.toThrow(
      "Failed to create friend code — INSERT returned no rows",
    );
  });

  it("accepts optional expiresAt", async () => {
    const { db, chain } = mockDb();
    const expiresAt = Date.now() + 86_400_000;
    // Quota check: .for("update") returns locked rows (empty = under quota)
    chain.for.mockResolvedValueOnce([]);
    chain.returning.mockResolvedValueOnce([makeFriendCodeRow({ expiresAt })]);

    const result = await generateFriendCode(db, ACCOUNT_ID, AUTH, mockAudit, {
      expiresAt,
    });

    expect(result.expiresAt).toBe(expiresAt);
  });
});

describe("listFriendCodes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns active non-expired codes", async () => {
    const { db, chain } = mockDb();
    const rows = [makeFriendCodeRow(), makeFriendCodeRow({ id: "frc_second" })];
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    // Override the final resolution in the chain to return rows
    chain.orderBy.mockResolvedValueOnce(rows);

    const result = await listFriendCodes(db, ACCOUNT_ID, AUTH);

    expect(result).toHaveLength(2);
    expect(chain.transaction).toHaveBeenCalled();
  });
});

describe("archiveFriendCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives an active code", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: CODE_ID }]);

    await archiveFriendCode(db, ACCOUNT_ID, CODE_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
  });

  it("throws NOT_FOUND for missing code", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(archiveFriendCode(db, ACCOUNT_ID, CODE_ID, AUTH, mockAudit)).rejects.toThrow(
      "Friend code not found",
    );
  });
});

describe("redeemFriendCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws NOT_FOUND for non-existent code", async () => {
    const { db, chain } = mockDb();
    // SELECT FOR UPDATE returns empty
    chain.for.mockReturnValue(chain);
    chain.limit.mockResolvedValueOnce([]);

    await expect(redeemFriendCode(db, "XXXX-YYYY", AUTH, mockAudit)).rejects.toThrow(
      "Friend code not found",
    );
  });

  it("throws FRIEND_CODE_EXPIRED for expired code", async () => {
    const { db, chain } = mockDb();
    const pastTime = Date.now() - 86_400_000;
    chain.for.mockReturnValue(chain);
    chain.limit.mockResolvedValueOnce([
      makeFriendCodeRow({
        accountId: OTHER_ACCOUNT_ID,
        expiresAt: pastTime,
      }),
    ]);

    await expect(redeemFriendCode(db, "ABCD-EFGH", AUTH, mockAudit)).rejects.toThrow("expired");
  });

  it("throws CONFLICT for self-redeem", async () => {
    const { db, chain } = mockDb();
    chain.for.mockReturnValue(chain);
    chain.limit.mockResolvedValueOnce([makeFriendCodeRow({ accountId: ACCOUNT_ID })]);

    await expect(redeemFriendCode(db, "ABCD-EFGH", AUTH, mockAudit)).rejects.toThrow(
      "Cannot redeem your own friend code",
    );
  });

  it("creates two directional connections on success", async () => {
    const { db, chain } = mockDb();
    chain.for.mockReturnValue(chain);
    // SELECT FOR UPDATE returns a valid code
    chain.limit
      .mockResolvedValueOnce([makeFriendCodeRow({ accountId: OTHER_ACCOUNT_ID })])
      // Check existing connections: none found
      .mockResolvedValueOnce([]);
    // Two connection inserts + code archive
    chain.returning
      .mockResolvedValueOnce([{ id: "fc_a" }])
      .mockResolvedValueOnce([{ id: "fc_b" }])
      .mockResolvedValueOnce([{ id: CODE_ID }]);

    const result = await redeemFriendCode(db, "ABCD-EFGH", AUTH, mockAudit);

    expect(result.connectionIds).toHaveLength(2);
    expect(chain.transaction).toHaveBeenCalled();
  });
});
