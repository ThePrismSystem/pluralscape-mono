import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { EncryptedBase64, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/check-dependents.js", () => ({
  checkDependents: vi.fn().mockResolvedValue({ dependents: [] }),
}));

vi.mock("../../lib/occ-update.js", () => ({
  assertOccUpdated: vi.fn(),
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("ent_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity } = await import("../../lib/entity-lifecycle.js");
const { checkDependents } = await import("../../lib/check-dependents.js");
const { assertOccUpdated } = await import("../../lib/occ-update.js");
const { dispatchWebhookEvent } = await import("../../services/webhook-dispatcher.js");
const { createHierarchyService } = await import("../../services/hierarchy-service-factory.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ENTITY_ID = "ent_test-entity";
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

// Minimal Zod-like schemas for the factory — must implement safeParse
const createSchema = {
  safeParse: vi.fn((data: unknown) => ({ success: true, data })),
};
const updateSchema = {
  safeParse: vi.fn((data: unknown) => ({ success: true, data })),
};

// Column mocks that match the HierarchyColumns interface shape
const mockColumns = {
  id: "id",
  systemId: "system_id",
  parentId: "parent_id",
  encryptedData: "encrypted_data" as EncryptedBase64,
  version: "version",
  archived: "archived",
  archivedAt: "archived_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const mockTable = { _: { name: "test_entities" } };

interface TestResult {
  readonly id: string;
  readonly name: string;
}

function makeTestRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY_ID,
    systemId: SYSTEM_ID,
    parentId: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    name: "Test Entity",
    ...overrides,
  };
}

const toResult = (row: Record<string, unknown>): TestResult => {
  const name = row.name as string | undefined;
  return {
    id: row.id as string,
    name: name ?? "Unnamed",
  };
};

function makeService(overrides?: {
  beforeUpdate?: (
    tx: unknown,
    entityId: string,
    parsed: Record<string, unknown>,
    systemId: SystemId,
  ) => Promise<void>;
  webhookEvents?: {
    created: string;
    updated: string;
    buildPayload: (id: string) => Record<string, unknown>;
  };
}) {
  return createHierarchyService<Record<string, unknown>, string, TestResult>({
    table: mockTable as never,
    columns: mockColumns as never,
    idPrefix: "ent_",
    entityName: "Entity",
    parentFieldName: "parentId",
    toResult,
    createSchema: createSchema as never,
    updateSchema: updateSchema as never,
    createInsertValues: (parsed) => ({ name: parsed.name }),
    updateSetValues: (parsed) => ({ name: parsed.name }),
    dependentChecks: [],
    events: {
      created: "entity.created" as never,
      updated: "entity.updated" as never,
      deleted: "entity.deleted" as never,
      archived: "entity.archived" as never,
      restored: "entity.restored" as never,
    },
    beforeUpdate: overrides?.beforeUpdate,
    webhookEvents: overrides?.webhookEvents as never,
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("hierarchy-service-factory — create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates an entity with no parent", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTestRow()]);

    const result = await service.create(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, name: "Test" },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "entity.created" }),
    );
  });

  it("creates an entity with a valid parent", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    // Parent exists check
    chain.limit.mockResolvedValueOnce([{ id: "ent_parent" }]);
    chain.returning.mockResolvedValueOnce([makeTestRow({ parentId: "ent_parent" })]);

    const result = await service.create(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, parentId: "ent_parent", name: "Child" },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
  });

  it("throws NOT_FOUND when parent does not exist", async () => {
    const service = makeService();
    const { db } = mockDb();
    // chain.limit defaults to [] — parent not found

    await expect(
      service.create(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentId: "ent_missing", name: "Child" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws internal error when INSERT returns no rows", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      service.create(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, name: "Test" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create entity");
  });

  it("dispatches webhook on create when webhookEvents configured", async () => {
    const buildPayload = vi.fn((id: string) => ({ entityId: id }));
    const service = makeService({
      webhookEvents: { created: "entity.created", updated: "entity.updated", buildPayload },
    });
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTestRow()]);

    await service.create(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, name: "Test" },
      AUTH,
      mockAudit,
    );

    expect(dispatchWebhookEvent).toHaveBeenCalled();
    expect(buildPayload).toHaveBeenCalledWith("ent_test-id");
  });

  it("skips webhook dispatch when webhookEvents not configured", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTestRow()]);
    vi.mocked(dispatchWebhookEvent).mockClear();

    await service.create(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, name: "Test" },
      AUTH,
      mockAudit,
    );

    expect(dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("throws 404 on ownership failure", async () => {
    const service = makeService();
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      service.create(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, name: "Test" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("treats non-string parentId as null", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    // parentId is a number — should be treated as null (no parent lookup)
    chain.returning.mockResolvedValueOnce([makeTestRow()]);

    const result = await service.create(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, parentId: 123, name: "Test" },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
  });
});

describe("hierarchy-service-factory — list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated entities", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTestRow()]);

    const result = await service.list(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("detects hasMore when more rows than limit", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTestRow({ id: "ent_a" }), makeTestRow({ id: "ent_b" })]);

    const result = await service.list(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.hasMore).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("includes archived entities when includeArchived is true", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTestRow({ archived: true })]);

    const result = await service.list(db, SYSTEM_ID, AUTH, undefined, 25, true);

    expect(result.data).toHaveLength(1);
  });

  it("applies cursor filter when cursor provided", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTestRow()]);

    const result = await service.list(db, SYSTEM_ID, AUTH, "ent_cursor");

    expect(result.data).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await service.list(db, SYSTEM_ID, AUTH, undefined, 999_999);

    expect(result.data).toEqual([]);
  });

  it("returns empty result when no entities", async () => {
    const service = makeService();
    const { db } = mockDb();

    const result = await service.list(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe("hierarchy-service-factory — get", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns entity when found", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTestRow()]);

    const result = await service.get(db, SYSTEM_ID, ENTITY_ID, AUTH);

    expect(result.id).toBe(ENTITY_ID);
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const service = makeService();
    const { db } = mockDb();

    await expect(service.get(db, SYSTEM_ID, "ent_missing", AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 on ownership failure", async () => {
    const service = makeService();
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(service.get(db, SYSTEM_ID, ENTITY_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("hierarchy-service-factory — update", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const validUpdatePayload = {
    encryptedData: VALID_BLOB_BASE64,
    version: 1,
    name: "Updated",
  };

  it("updates entity successfully", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    const updatedRow = makeTestRow({ name: "Updated", version: 2 });
    vi.mocked(assertOccUpdated).mockResolvedValueOnce(updatedRow);

    const result = await service.update(
      db,
      SYSTEM_ID,
      ENTITY_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(ENTITY_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "entity.updated" }),
    );
  });

  it("calls beforeUpdate hook when configured", async () => {
    const beforeUpdate = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ beforeUpdate });
    const { db, chain } = mockDb();
    vi.mocked(assertOccUpdated).mockResolvedValueOnce(makeTestRow({ version: 2 }));

    await service.update(db, SYSTEM_ID, ENTITY_ID, validUpdatePayload, AUTH, mockAudit);

    expect(beforeUpdate).toHaveBeenCalledWith(chain, ENTITY_ID, expect.any(Object), SYSTEM_ID);
  });

  it("dispatches webhook on update when webhookEvents configured", async () => {
    const buildPayload = vi.fn((id: string) => ({ entityId: id }));
    const service = makeService({
      webhookEvents: { created: "entity.created", updated: "entity.updated", buildPayload },
    });
    const { db } = mockDb();
    vi.mocked(assertOccUpdated).mockResolvedValueOnce(makeTestRow({ version: 2 }));
    vi.mocked(dispatchWebhookEvent).mockClear();

    await service.update(db, SYSTEM_ID, ENTITY_ID, validUpdatePayload, AUTH, mockAudit);

    expect(dispatchWebhookEvent).toHaveBeenCalled();
  });

  it("skips webhook dispatch on update when not configured", async () => {
    const service = makeService();
    const { db } = mockDb();
    vi.mocked(assertOccUpdated).mockResolvedValueOnce(makeTestRow({ version: 2 }));
    vi.mocked(dispatchWebhookEvent).mockClear();

    await service.update(db, SYSTEM_ID, ENTITY_ID, validUpdatePayload, AUTH, mockAudit);

    expect(dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("throws 404 on ownership failure", async () => {
    const service = makeService();
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      service.update(db, SYSTEM_ID, ENTITY_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("hierarchy-service-factory — remove", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes entity when it exists and has no dependents", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);

    await service.remove(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "entity.deleted" }),
    );
    expect(checkDependents).toHaveBeenCalledWith(chain, []);
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const service = makeService();
    const { db } = mockDb();

    await expect(service.remove(db, SYSTEM_ID, "ent_missing", AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 on ownership failure", async () => {
    const service = makeService();
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(service.remove(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("hierarchy-service-factory — archive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("delegates to archiveEntity with correct lifecycle config", async () => {
    const service = makeService();
    const { db } = mockDb();

    await service.archive(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(archiveEntity).toHaveBeenCalledWith(
      db,
      SYSTEM_ID,
      ENTITY_ID,
      AUTH,
      mockAudit,
      expect.objectContaining({
        entityName: "Entity",
        archiveEvent: "entity.archived",
        restoreEvent: "entity.restored",
      }),
    );
  });
});

describe("hierarchy-service-factory — restore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived entity with no parent", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    // Existing archived entity with no parent
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, parentId: null }]);
    chain.returning.mockResolvedValueOnce([makeTestRow({ archived: false })]);

    const result = await service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.id).toBe(ENTITY_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "entity.restored" }),
    );
  });

  it("restores entity with active parent (preserves parent)", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    // Existing archived entity with parent
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, parentId: "ent_parent" }]);
    // Parent exists and is active
    chain.limit.mockResolvedValueOnce([{ archived: false }]);
    chain.returning.mockResolvedValueOnce([
      makeTestRow({ archived: false, parentId: "ent_parent" }),
    ]);

    const result = await service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.id).toBe(ENTITY_ID);
  });

  it("promotes to root when parent is archived", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    // Existing archived entity with archived parent
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, parentId: "ent_parent" }]);
    // Parent is archived
    chain.limit.mockResolvedValueOnce([{ archived: true }]);
    chain.returning.mockResolvedValueOnce([makeTestRow({ archived: false, parentId: null })]);

    const result = await service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.id).toBe(ENTITY_ID);
  });

  it("promotes to root when parent does not exist", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, parentId: "ent_gone" }]);
    // Parent not found
    chain.limit.mockResolvedValueOnce([]);
    chain.returning.mockResolvedValueOnce([makeTestRow({ archived: false, parentId: null })]);

    const result = await service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.id).toBe(ENTITY_ID);
  });

  it("throws NOT_FOUND when archived entity does not exist", async () => {
    const service = makeService();
    const { db } = mockDb();

    await expect(service.restore(db, SYSTEM_ID, "ent_missing", AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws NOT_FOUND when update returns empty array", async () => {
    const service = makeService();
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID, parentId: null }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 on ownership failure", async () => {
    const service = makeService();
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(service.restore(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
