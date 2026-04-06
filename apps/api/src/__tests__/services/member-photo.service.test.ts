import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";

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

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const {
  createMemberPhoto,
  getMemberPhoto,
  listMemberPhotos,
  reorderMemberPhotos,
  archiveMemberPhoto,
  restoreMemberPhoto,
  deleteMemberPhoto,
} = await import("../../services/member-photo.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;
const PHOTO_ID = "mp_test-photo" as MemberPhotoId;

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);
const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makePhotoRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mp_test-photo",
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    sortOrder: 0,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createMemberPhoto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a photo with auto-assigned sortOrder", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → .where() chains to .limit()
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // assertMemberActive → chains to .limit()
      .mockReturnValueOnce(chain) // FOR UPDATE lock → chains to .for()
      .mockResolvedValueOnce([{ count: 0 }]) // per-member count query
      .mockResolvedValueOnce([{ count: 0 }]) // system-wide count query
      .mockResolvedValueOnce([{ maxSort: null }]); // max sort query (first photo)
    chain.returning.mockResolvedValueOnce([makePhotoRow()]);

    const result = await createMemberPhoto(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(PHOTO_ID);
    expect(result.sortOrder).toBe(0);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member-photo.created" }),
    );
  });

  it("creates a photo with explicit sortOrder", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // assertMemberActive → chains to .limit()
      .mockReturnValueOnce(chain) // FOR UPDATE lock → chains to .for()
      .mockResolvedValueOnce([{ count: 0 }]) // per-member count query
      .mockResolvedValueOnce([{ count: 0 }]); // system-wide count query
    // No max sort query when sortOrder is explicit
    chain.returning.mockResolvedValueOnce([makePhotoRow({ sortOrder: 5 })]);

    const result = await createMemberPhoto(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, sortOrder: 5 },
      AUTH,
      mockAudit,
    );

    expect(result.sortOrder).toBe(5);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("throws QUOTA_EXCEEDED when photo limit reached", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // assertMemberActive → chains to .limit()
      .mockReturnValueOnce(chain) // FOR UPDATE lock → chains to .for()
      .mockResolvedValueOnce([{ count: 5 }]); // per-member count at quota

    await expect(
      createMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "QUOTA_EXCEEDED" }));
  });

  it("throws VALIDATION_ERROR for invalid body", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    await expect(createMemberPhoto(db, SYSTEM_ID, MEMBER_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for oversized blob (rejected by schema validation)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    const oversized = Buffer.from(new Uint8Array(140_000)).toString("base64");

    await expect(
      createMemberPhoto(db, SYSTEM_ID, MEMBER_ID, { encryptedData: oversized }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws NOT_FOUND when member does not exist", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive returns empty → member not found
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    await expect(
      createMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws VALIDATION_ERROR for malformed blob", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // assertMemberActive → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]); // count query

    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    await expect(
      createMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("getMemberPhoto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a single photo by id", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePhotoRow()]);

    const result = await getMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH);

    expect(result.id).toBe(PHOTO_ID);
    expect(result.memberId).toBe(MEMBER_ID);
  });

  it("throws NOT_FOUND when photo does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("listMemberPhotos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns paginated photos for a member", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive
    chain.limit
      .mockResolvedValueOnce([{ id: MEMBER_ID }]) // assertMemberActive
      .mockResolvedValueOnce([makePhotoRow(), makePhotoRow({ id: "mp_second", sortOrder: 1 })]); // list query
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(PHOTO_ID);
    expect(result.data[1]?.id).toBe("mp_second");
    expect(result.hasMore).toBe(false);
  });

  it("returns empty list when member has no photos", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: MEMBER_ID }]) // assertMemberActive
      .mockResolvedValueOnce([]); // list query
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("throws NOT_FOUND when member does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    await expect(listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("returns hasMore true and nextCursor when more results exist", async () => {
    const { db, chain } = mockDb();
    // Default limit is 25; return 26 rows to trigger hasMore=true
    const rows = Array.from({ length: 26 }, (_, i) =>
      makePhotoRow({ id: `mp_photo-${String(i).padStart(3, "0")}`, sortOrder: i }),
    );
    chain.limit
      .mockResolvedValueOnce([{ id: MEMBER_ID }]) // assertMemberActive
      .mockResolvedValueOnce(rows); // list query
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns hasMore false and null nextCursor on last page", async () => {
    const { db, chain } = mockDb();
    const rows = [makePhotoRow(), makePhotoRow({ id: "mp_second", sortOrder: 1 })];
    chain.limit
      .mockResolvedValueOnce([{ id: MEMBER_ID }]) // assertMemberActive
      .mockResolvedValueOnce(rows); // list query
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe("reorderMemberPhotos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("reorders photos successfully", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()
    // In tx: select existing photos — .where() is terminal here
    chain.where.mockResolvedValueOnce([{ id: PHOTO_ID }, { id: "mp_second" }]);
    // Batch update: .returning() x2 (each update call now uses returning)
    chain.returning
      .mockResolvedValueOnce([{ id: PHOTO_ID }])
      .mockResolvedValueOnce([{ id: "mp_second" }]);
    // Final select+orderBy
    chain.orderBy.mockResolvedValueOnce([
      makePhotoRow({ sortOrder: 1 }),
      makePhotoRow({ id: "mp_second", sortOrder: 0 }),
    ]);

    const result = await reorderMemberPhotos(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        order: [
          { id: PHOTO_ID, sortOrder: 1 },
          { id: "mp_second", sortOrder: 0 },
        ],
      },
      AUTH,
      mockAudit,
    );

    expect(result).toHaveLength(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member-photo.reordered" }),
    );
  });

  it("throws VALIDATION_ERROR when photo does not belong to member", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()
    // In tx: select existing photos — returns only one known photo
    chain.where.mockResolvedValueOnce([{ id: PHOTO_ID }]);

    await expect(
      reorderMemberPhotos(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { order: [{ id: "mp_unknown" as MemberPhotoId, sortOrder: 0 }] },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws NOT_FOUND when a batch update returns empty for one photo", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()
    // In tx: select existing photos — both exist
    chain.where.mockResolvedValueOnce([{ id: PHOTO_ID }, { id: "mp_second" }]);
    // Batch update: first succeeds, second returns empty (simulating race condition)
    chain.returning.mockResolvedValueOnce([{ id: PHOTO_ID }]).mockResolvedValueOnce([]);

    await expect(
      reorderMemberPhotos(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        {
          order: [
            { id: PHOTO_ID, sortOrder: 1 },
            { id: "mp_second" as MemberPhotoId, sortOrder: 0 },
          ],
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws VALIDATION_ERROR for invalid body", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    await expect(
      reorderMemberPhotos(db, SYSTEM_ID, MEMBER_ID, { order: [] }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("archiveMemberPhoto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a photo successfully", async () => {
    const { db, chain } = mockDb();
    // In tx: select photo by id → .limit(1) finds it
    chain.limit.mockResolvedValueOnce([{ id: PHOTO_ID }]);
    chain.where.mockReturnValueOnce(chain); // select → chains to .limit()

    await archiveMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member-photo.archived" }),
    );
  });

  it("throws NOT_FOUND when photo does not exist", async () => {
    const { db, chain } = mockDb();
    // In tx: select photo by id → .limit(1) returns empty
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain); // select → chains to .limit()

    await expect(
      archiveMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        "mp_nonexistent" as MemberPhotoId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreMemberPhoto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived photo", async () => {
    const { db, chain } = mockDb();
    const archivedRow = makePhotoRow({ archived: true, archivedAt: 2000 });
    // transaction → select().from().where().limit() finds archived photo
    chain.limit.mockResolvedValueOnce([archivedRow]);
    // transaction → update().set().where().returning() → restored row
    chain.returning.mockResolvedValueOnce([makePhotoRow({ archived: false, archivedAt: null })]);

    const result = await restoreMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH, mockAudit);

    expect(result.id).toBe(PHOTO_ID);
    expect(result.archived).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member-photo.restored" }),
    );
  });

  it("throws NOT_FOUND when photo not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain);

    await expect(
      restoreMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        "mp_nonexistent" as MemberPhotoId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteMemberPhoto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a photo successfully", async () => {
    const { db, chain } = mockDb();
    // In tx: select photo by id → .limit(1) finds it
    chain.limit.mockResolvedValueOnce([{ id: PHOTO_ID }]);
    chain.where.mockReturnValueOnce(chain); // select → chains to .limit()

    await deleteMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member-photo.deleted" }),
    );
  });

  it("throws NOT_FOUND when photo does not exist", async () => {
    const { db, chain } = mockDb();
    // In tx: select photo by id → .limit(1) returns empty
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain); // select → chains to .limit()

    await expect(
      deleteMemberPhoto(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        "mp_nonexistent" as MemberPhotoId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("rejects cross-system access", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
      throw new ApiHttpError(403, "FORBIDDEN", "System ownership check failed");
    });
    const { db } = mockDb();

    await expect(
      deleteMemberPhoto(db, SYSTEM_ID, MEMBER_ID, PHOTO_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
  });
});
