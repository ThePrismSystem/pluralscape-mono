import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
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
const { createMemberPhoto, listMemberPhotos, reorderMemberPhotos, archiveMemberPhoto } =
  await import("../../services/member-photo.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;
const PHOTO_ID = "mp_test-photo" as MemberPhotoId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

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
      .mockResolvedValueOnce([{ count: 0 }]) // count query
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
      expect.anything(),
      expect.objectContaining({ eventType: "member-photo.created" }),
    );
  });

  it("creates a photo with explicit sortOrder", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // assertMemberActive → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]); // count query
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
      .mockResolvedValueOnce([{ count: 50 }]); // count at quota

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
});

describe("listMemberPhotos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns ordered photos for a member", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()
    // list query: .where() → chain, then .orderBy() is terminal
    chain.orderBy.mockResolvedValueOnce([
      makePhotoRow(),
      makePhotoRow({ id: "mp_second", sortOrder: 1 }),
    ]);

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(PHOTO_ID);
    expect(result[1]?.id).toBe("mp_second");
  });

  it("returns empty list when member has no photos", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()
    chain.orderBy.mockResolvedValueOnce([]);

    const result = await listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when member does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain); // assertMemberActive → chains to .limit()

    await expect(listMemberPhotos(db, SYSTEM_ID, MEMBER_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
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
    // Batch update: .where() x2 (each update call)
    chain.where.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
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
      expect.anything(),
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
      expect.anything(),
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
