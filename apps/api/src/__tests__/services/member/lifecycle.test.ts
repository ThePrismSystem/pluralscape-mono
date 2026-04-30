/**
 * Unit tests for member/lifecycle.ts — archive, restore, delete.
 */
import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

import { AUTH, MEMBER_ID, SYSTEM_ID, makeMemberRow } from "./internal.js";

import type { MemberId } from "@pluralscape/types";

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

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { archiveMember, restoreMember, deleteMember } =
  await import("../../../services/member/lifecycle.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("archiveMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives member and cascades to photos but preserves field values", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);

    await archiveMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalled();
    expect(chain.delete).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({
        eventType: "member.archived",
        detail: expect.stringContaining("field values preserved"),
      }),
    );
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();
    await expect(
      archiveMember(db, SYSTEM_ID, brandId<MemberId>("mem_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived member", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow({ archived: true, archivedAt: 2000 })]);
    const restoredRow = makeMemberRow({ archived: false, archivedAt: null });
    chain.returning.mockResolvedValueOnce([restoredRow]);

    const result = await restoreMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(result.id).toBe("mem_test-member");
    expect(result.archived).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.restored" }),
    );
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();
    await expect(
      restoreMember(db, SYSTEM_ID, brandId<MemberId>("mem_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes member with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // 11 dependent count queries, all zero
    for (let i = 0; i < 11; i++) {
      chain.where.mockResolvedValueOnce([{ count: 0 }]);
    }

    await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.deleted" }),
    );
    expect(chain.delete).toHaveBeenCalled();
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();
    await expect(
      deleteMember(db, SYSTEM_ID, brandId<MemberId>("mem_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 HAS_DEPENDENTS when member has photos", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 3 }]) // photos
      .mockResolvedValueOnce([{ count: 0 }]) // fieldValues
      .mockResolvedValueOnce([{ count: 0 }]) // groupMemberships
      .mockResolvedValueOnce([{ count: 0 }]) // frontingSessions
      .mockResolvedValueOnce([{ count: 0 }]) // relationships
      .mockResolvedValueOnce([{ count: 0 }]) // notes
      .mockResolvedValueOnce([{ count: 0 }]) // frontingComments
      .mockResolvedValueOnce([{ count: 0 }]) // checkInRecords
      .mockResolvedValueOnce([{ count: 0 }]) // polls
      .mockResolvedValueOnce([{ count: 0 }]) // acknowledgements
      .mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    await expect(deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
    );
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws 409 HAS_DEPENDENTS with multiple dependent types", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 2 }]) // photos
      .mockResolvedValueOnce([{ count: 5 }]) // fieldValues
      .mockResolvedValueOnce([{ count: 0 }]) // groupMemberships
      .mockResolvedValueOnce([{ count: 1 }]) // frontingSessions
      .mockResolvedValueOnce([{ count: 0 }]) // relationships
      .mockResolvedValueOnce([{ count: 3 }]) // notes
      .mockResolvedValueOnce([{ count: 0 }]) // frontingComments
      .mockResolvedValueOnce([{ count: 0 }]) // checkInRecords
      .mockResolvedValueOnce([{ count: 0 }]) // polls
      .mockResolvedValueOnce([{ count: 0 }]) // acknowledgements
      .mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([
        { type: "photos", count: 2 },
        { type: "fieldValues", count: 5 },
        { type: "frontingSessions", count: 1 },
        { type: "notes", count: 3 },
      ]);
    }
    expect(mockAudit).not.toHaveBeenCalled();
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it("throws 409 HAS_DEPENDENTS for relationships", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }]) // photos
      .mockResolvedValueOnce([{ count: 0 }]) // fieldValues
      .mockResolvedValueOnce([{ count: 0 }]) // groupMemberships
      .mockResolvedValueOnce([{ count: 0 }]) // frontingSessions
      .mockResolvedValueOnce([{ count: 2 }]) // relationships
      .mockResolvedValueOnce([{ count: 0 }]) // notes
      .mockResolvedValueOnce([{ count: 0 }]) // frontingComments
      .mockResolvedValueOnce([{ count: 0 }]) // checkInRecords
      .mockResolvedValueOnce([{ count: 0 }]) // polls
      .mockResolvedValueOnce([{ count: 0 }]) // acknowledgements
      .mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([{ type: "relationships", count: 2 }]);
    }
  });

  it("rejects cross-system access", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
      throw new ApiHttpError(403, "FORBIDDEN", "System ownership check failed");
    });
    const { db } = mockDb();
    await expect(deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });

  it("throws 409 HAS_DEPENDENTS for acknowledgements", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    for (let i = 0; i < 9; i++) {
      chain.where.mockResolvedValueOnce([{ count: 0 }]);
    }
    chain.where.mockResolvedValueOnce([{ count: 4 }]); // acknowledgements
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([{ type: "acknowledgements", count: 4 }]);
    }
  });
});
