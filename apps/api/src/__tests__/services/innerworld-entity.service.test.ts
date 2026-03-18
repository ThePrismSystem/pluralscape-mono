import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { InnerWorldEntityId, InnerWorldRegionId, SystemId } from "@pluralscape/types";

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
  createEntity,
  listEntities,
  getEntity,
  updateEntity,
  archiveEntity,
  restoreEntity,
  deleteEntity,
} = await import("../../services/innerworld-entity.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const ENTITY_ID = "iwe_test-entity" as InnerWorldEntityId;
const REGION_ID = "iwr_test-region" as InnerWorldRegionId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

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
      expect.anything(),
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
      expect.anything(),
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
});

describe("listEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no entities exist", async () => {
    const { db } = mockDb();

    const result = await listEntities(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns entities with pagination info", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityRow()]);

    const result = await listEntities(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(ENTITY_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("detects hasMore and returns nextCursor when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeEntityRow({ id: "iwe_a" }), makeEntityRow({ id: "iwe_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listEntities(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("filters by regionId when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityRow({ regionId: REGION_ID })]);

    const result = await listEntities(db, SYSTEM_ID, AUTH, { regionId: REGION_ID });

    expect(result.items).toHaveLength(1);
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
      getEntity(db, SYSTEM_ID, "iwe_nonexistent" as InnerWorldEntityId, AUTH),
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
      expect.anything(),
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
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]); // existence check

    await archiveEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "innerworld-entity.archived" }),
    );
  });

  it("throws 404 when entity not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveEntity(db, SYSTEM_ID, "iwe_nonexistent" as InnerWorldEntityId, AUTH, mockAudit),
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
      expect.anything(),
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
      expect.anything(),
      expect.objectContaining({ eventType: "innerworld-entity.restored" }),
    );
  });

  it("throws 404 when archived entity not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreEntity(db, SYSTEM_ID, "iwe_nonexistent" as InnerWorldEntityId, AUTH, mockAudit),
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
      expect.anything(),
      expect.objectContaining({ eventType: "innerworld-entity.deleted" }),
    );
  });

  it("throws 404 when entity not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteEntity(db, SYSTEM_ID, "iwe_nonexistent" as InnerWorldEntityId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
