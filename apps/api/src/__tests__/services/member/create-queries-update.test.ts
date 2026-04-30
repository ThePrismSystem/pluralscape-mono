/**
 * Unit tests for member/create.ts, member/queries.ts, member/update.ts.
 *
 * Covers: createMember, listMembers, getMember, updateMember.
 */
import { PAGINATION, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { MemberId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const { createMember } = await import("../../services/member/create.js");
const { listMembers, getMember } = await import("../../services/member/queries.js");
const { updateMember } = await import("../../services/member/update.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { dispatchWebhookEvent: mockDispatchWebhookEvent } =
  await import("../../services/webhook-dispatcher.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const MEMBER_ID = brandId<MemberId>("mem_test-member");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);
const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeMemberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mem_test-member",
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── createMember ──────────────────────────────────────────────────────

describe("createMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a member and writes audit log", async () => {
    const { db, chain } = mockDb();
    const newRow = makeMemberRow();
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await createMember(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.created" }),
    );
    expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
      chain,
      SYSTEM_ID,
      "member.created",
      expect.objectContaining({ memberId: expect.any(String) }),
    );
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws QUOTA_EXCEEDED when member count is at maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([{ count: 5000 }]);

    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }));
  });
});

// ── listMembers ───────────────────────────────────────────────────────

describe("listMembers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no members exist", async () => {
    const { db } = mockDb();
    const result = await listMembers(db, SYSTEM_ID, AUTH);
    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns members for the system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);

    const result = await listMembers(db, SYSTEM_ID, AUTH);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("mem_test-member");
    expect(result.hasMore).toBe(false);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeMemberRow({ id: "mem_a" }), makeMemberRow({ id: "mem_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listMembers(db, SYSTEM_ID, AUTH, { limit: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("mem_a");
    }
  });

  it("caps limit to MAX_MEMBER_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listMembers(db, SYSTEM_ID, AUTH, { limit: 999 });
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses default limit when not specified", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listMembers(db, SYSTEM_ID, AUTH);
    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("applies cursor filter when cursor provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listMembers(db, SYSTEM_ID, AUTH, { cursor: "mem_cursor-id" });
    expect(chain.where).toHaveBeenCalled();
  });

  it("includes archived members when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow({ archived: true, archivedAt: 2000 })]);
    const result = await listMembers(db, SYSTEM_ID, AUTH, { includeArchived: true });
    expect(result.data).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });
});

// ── getMember ─────────────────────────────────────────────────────────

describe("getMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns member when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);

    const result = await getMember(db, SYSTEM_ID, MEMBER_ID, AUTH);
    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(1);
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();
    await expect(
      getMember(db, SYSTEM_ID, brandId<MemberId>("mem_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── updateMember ──────────────────────────────────────────────────────

describe("updateMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates member with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeMemberRow({ version: 2, encryptedData: new Uint8Array([1, 2, 3]) });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);

    await expect(
      updateMember(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateMember(
        db,
        SYSTEM_ID,
        brandId<MemberId>("mem_nonexistent"),
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
