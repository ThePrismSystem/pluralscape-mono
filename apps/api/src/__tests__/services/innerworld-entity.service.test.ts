import { PAGINATION, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor, toCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { InnerWorldEntityId, InnerWorldRegionId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/db/pg", () => ({
  innerworldEntities: {
    id: "id",
    systemId: "system_id",
    regionId: "region_id",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  innerworldRegions: {
    id: "id",
    systemId: "system_id",
    archived: "archived",
  },
  systems: {
    id: "id",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    count: vi.fn(() => "count(*)"),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
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
const { createEntity } = await import("../../services/innerworld/entity/create.js");
const { listEntities, getEntity } = await import("../../services/innerworld/entity/queries.js");
const { updateEntity } = await import("../../services/innerworld/entity/update.js");
const { archiveEntity, restoreEntity, deleteEntity } =
  await import("../../services/innerworld/entity/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ENTITY_ID = brandId<InnerWorldEntityId>("iwe_test-entity");
const REGION_ID = brandId<InnerWorldRegionId>("iwr_test-region");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeEntityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY_ID,
    systemId: SYSTEM_ID,
    regionId: null,
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

describe("createEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createEntity(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("creates an entity successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityRow()]);

    const result = await createEntity(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.regionId).toBeNull();
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.created" }),
    );
  });

  it("creates an entity with a regionId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: REGION_ID }]); // region lookup
    chain.returning.mockResolvedValueOnce([makeEntityRow({ regionId: REGION_ID })]);

    const result = await createEntity(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, regionId: REGION_ID },
      AUTH,
      mockAudit,
    );

    expect(result.regionId).toBe(REGION_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.created" }),
    );
  });

  it("throws 404 when regionId not found in system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // region not found

    await expect(
      createEntity(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, regionId: REGION_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createEntity(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
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
      createEntity(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws QUOTA_EXCEEDED when entity count is at maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
      .mockResolvedValueOnce([{ count: 500 }]); // quota count -> at limit

    await expect(
      createEntity(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }));
  });

  it("allows creation when entity count is below maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
      .mockResolvedValueOnce([{ count: 499 }]); // quota count -> below limit
    chain.returning.mockResolvedValueOnce([makeEntityRow()]);

    const result = await createEntity(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
  });

  it("acquires FOR UPDATE lock on system row during quota check", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityRow()]);

    await createEntity(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit);

    expect(chain.for).toHaveBeenCalledWith("update");
  });
});

describe("listEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no entities exist", async () => {
    const { db } = mockDb();

    const result = await listEntities(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns entities with pagination info", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityRow()]);

    const result = await listEntities(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(ENTITY_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("detects hasMore and returns nextCursor when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeEntityRow({ id: "iwe_a" }), makeEntityRow({ id: "iwe_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listEntities(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("iwe_a");
    }
  });

  it("filters by regionId when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityRow({ regionId: REGION_ID })]);

    const result = await listEntities(db, SYSTEM_ID, AUTH, { regionId: REGION_ID });

    expect(result.data).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("applies cursor filter when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listEntities(db, SYSTEM_ID, AUTH, { cursor: toCursor(ENTITY_ID) });

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns entity for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityRow()]);

    const result = await getEntity(db, SYSTEM_ID, ENTITY_ID, AUTH);

    expect(result.id).toBe(ENTITY_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.archived).toBe(false);
  });

  it("throws 404 when entity not found", async () => {
    const { db } = mockDb();

    await expect(
      getEntity(db, SYSTEM_ID, brandId<InnerWorldEntityId>("iwe_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates entity successfully with version bump", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeEntityRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateEntity(
      db,
      SYSTEM_ID,
      ENTITY_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // update matched nothing
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]); // entity exists → conflict

    await expect(
      updateEntity(
        db,
        SYSTEM_ID,
        ENTITY_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when entity not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // update matched nothing
    chain.limit.mockResolvedValueOnce([]); // entity also absent → 404

    await expect(
      updateEntity(
        db,
        SYSTEM_ID,
        ENTITY_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (missing version)", async () => {
    const { db } = mockDb();

    await expect(
      updateEntity(db, SYSTEM_ID, ENTITY_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("archiveEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives an entity successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]); // existence check

    await archiveEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.archived" }),
    );
  });

  it("throws 404 when entity not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveEntity(db, SYSTEM_ID, brandId<InnerWorldEntityId>("iwe_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived entity successfully", async () => {
    const { db, chain } = mockDb();
    // existence check returns archived entity with no region
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, regionId: null }]);
    chain.returning.mockResolvedValueOnce([
      makeEntityRow({ archived: false, archivedAt: null, version: 2 }),
    ]);

    const result = await restoreEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.restored" }),
    );
  });

  it("promotes entity to top-level (nullifies regionId) when region is archived", async () => {
    const { db, chain } = mockDb();
    // existence check returns archived entity with a region
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, regionId: REGION_ID }]);
    // region lookup returns archived region
    chain.limit.mockResolvedValueOnce([{ archived: true }]);
    chain.returning.mockResolvedValueOnce([
      makeEntityRow({ archived: false, archivedAt: null, regionId: null, version: 2 }),
    ]);

    const result = await restoreEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.regionId).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.restored" }),
    );
  });

  it("throws 404 when archived entity not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreEntity(db, SYSTEM_ID, brandId<InnerWorldEntityId>("iwe_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes an entity successfully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]); // existence check

    await deleteEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "innerworld-entity.deleted" }),
    );
  });

  it("throws 404 when entity not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteEntity(db, SYSTEM_ID, brandId<InnerWorldEntityId>("iwe_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
