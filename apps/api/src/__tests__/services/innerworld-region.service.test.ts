import { PAGINATION, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor, toCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { InnerWorldRegionId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/db/pg", () => ({
  innerworldEntities: {
    id: "id",
    regionId: "region_id",
    systemId: "system_id",
    archived: "archived",
    archivedAt: "archived_at",
    updatedAt: "updated_at",
  },
  innerworldRegions: {
    id: "id",
    systemId: "system_id",
    parentRegionId: "parent_region_id",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  systems: { id: "id" },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    count: vi.fn(() => "count(*)"),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
    inArray: vi.fn((a: unknown, b: unknown) => ["inArray", a, b]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

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

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { InvalidInputError } = await import("@pluralscape/crypto");
const { createRegion } = await import("../../services/innerworld-region/create.js");
const { listRegions, getRegion } = await import("../../services/innerworld-region/queries.js");
const { updateRegion } = await import("../../services/innerworld-region/update.js");
const { archiveRegion, restoreRegion, deleteRegion } =
  await import("../../services/innerworld-region/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const REGION_ID = brandId<InnerWorldRegionId>("iwr_test-region");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeRegionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: REGION_ID,
    systemId: SYSTEM_ID,
    parentRegionId: null,
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

describe("createRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createRegion(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("creates a region successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeRegionRow()]);

    const result = await createRegion(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(REGION_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.parentRegionId).toBeNull();
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.created" }),
    );
  });

  it("creates a region with parentRegionId when parent exists", async () => {
    const { db, chain } = mockDb();
    const parentId = brandId<InnerWorldRegionId>("iwr_parent-region");
    chain.limit.mockResolvedValueOnce([{ id: parentId }]); // parent found
    chain.returning.mockResolvedValueOnce([makeRegionRow({ parentRegionId: parentId })]);

    const result = await createRegion(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, parentRegionId: parentId },
      AUTH,
      mockAudit,
    );

    expect(result.parentRegionId).toBe(parentId);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.created" }),
    );
  });

  it("throws 404 when parentRegionId not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // parent not found

    await expect(
      createRegion(
        db,
        SYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentRegionId: brandId<InnerWorldRegionId>("iwr_nonexistent"),
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createRegion(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createRegion(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws QUOTA_EXCEEDED when region count is at maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
      .mockResolvedValueOnce([{ count: 100 }]); // quota count -> at limit

    await expect(
      createRegion(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }));
  });

  it("allows creation when region count is below maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
      .mockResolvedValueOnce([{ count: 99 }]); // quota count -> below limit
    chain.returning.mockResolvedValueOnce([makeRegionRow()]);

    const result = await createRegion(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(REGION_ID);
  });

  it("acquires FOR UPDATE lock on system row during quota check", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeRegionRow()]);

    await createRegion(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit);

    expect(chain.for).toHaveBeenCalledWith("update");
  });
});

describe("listRegions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no regions exist", async () => {
    const { db } = mockDb();

    const result = await listRegions(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns regions with pagination", async () => {
    const { db, chain } = mockDb();
    const rows = [makeRegionRow({ id: "iwr_a" }), makeRegionRow({ id: "iwr_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listRegions(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("iwr_a");
    }
  });

  it("includes archived regions when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    const archivedRow = makeRegionRow({ archived: true, archivedAt: 2000 });
    chain.limit.mockResolvedValueOnce([archivedRow]);

    const result = await listRegions(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.archived).toBe(true);
  });

  it("applies cursor filter when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listRegions(db, SYSTEM_ID, AUTH, { cursor: toCursor("iwr_cursor-id") });

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns region for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRegionRow()]);

    const result = await getRegion(db, SYSTEM_ID, REGION_ID, AUTH);

    expect(result.id).toBe(REGION_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws 404 when region not found", async () => {
    const { db } = mockDb();

    await expect(
      getRegion(db, SYSTEM_ID, brandId<InnerWorldRegionId>("iwr_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates region successfully with version bump", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeRegionRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateRegion(
      db,
      SYSTEM_ID,
      REGION_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // OCC update found nothing
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID }]); // but region exists

    await expect(
      updateRegion(
        db,
        SYSTEM_ID,
        REGION_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when region not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // OCC update found nothing
    chain.limit.mockResolvedValueOnce([]); // and region doesn't exist

    await expect(
      updateRegion(
        db,
        SYSTEM_ID,
        REGION_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("archiveRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives region and cascades to children and entities", async () => {
    const { db, chain } = mockDb();
    // existence check
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID }]);
    // child frontier pass 1: one child
    chain.where
      .mockReturnValueOnce(chain) // existence select → chained
      .mockResolvedValueOnce([{ id: "iwr_child" }]) // first frontier children
      .mockResolvedValueOnce([]); // second frontier: no more children

    await archiveRegion(db, SYSTEM_ID, REGION_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.archived" }),
    );
  });

  it("throws 404 when region not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveRegion(db, SYSTEM_ID, brandId<InnerWorldRegionId>("iwr_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived region", async () => {
    const { db, chain } = mockDb();
    // existing archived region with no parent
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID, parentRegionId: null }]);
    // update returning
    chain.returning.mockResolvedValueOnce([makeRegionRow({ archived: false, archivedAt: null })]);

    const result = await restoreRegion(db, SYSTEM_ID, REGION_ID, AUTH, mockAudit);

    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.restored" }),
    );
  });

  it("promotes to root when parent is archived", async () => {
    const { db, chain } = mockDb();
    const parentId = brandId<InnerWorldRegionId>("iwr_archived-parent");
    // existing archived region with a parent
    chain.limit
      .mockResolvedValueOnce([{ id: REGION_ID, parentRegionId: parentId }])
      // parent check: parent is archived
      .mockResolvedValueOnce([{ archived: true }]);
    // update returning with null parentRegionId (promoted to root)
    chain.returning.mockResolvedValueOnce([
      makeRegionRow({ parentRegionId: null, archived: false, archivedAt: null }),
    ]);

    const result = await restoreRegion(db, SYSTEM_ID, REGION_ID, AUTH, mockAudit);

    expect(result.parentRegionId).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.restored" }),
    );
  });

  it("throws 404 when archived region not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreRegion(db, SYSTEM_ID, brandId<InnerWorldRegionId>("iwr_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a region with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID }]); // existence check
    chain.where
      .mockReturnValueOnce(chain) // existence select → chained to .limit()
      .mockResolvedValueOnce([{ count: 0 }]) // child regions count
      .mockResolvedValueOnce([{ count: 0 }]); // entities count

    await deleteRegion(db, SYSTEM_ID, REGION_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-region.deleted" }),
    );
  });

  it("throws 409 HAS_DEPENDENTS when region has child regions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID }]); // existence check
    chain.where
      .mockReturnValueOnce(chain) // existence select → chained
      .mockResolvedValueOnce([{ count: 2 }]) // child regions
      .mockResolvedValueOnce([{ count: 0 }]); // entities

    await expect(deleteRegion(db, SYSTEM_ID, REGION_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("2 child region(s)"),
      }),
    );
  });

  it("throws 404 when region not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteRegion(db, SYSTEM_ID, brandId<InnerWorldRegionId>("iwr_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
