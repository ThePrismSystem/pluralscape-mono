import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveAccountEntity,
  archiveEntity,
  deleteEntity,
  restoreAccountEntity,
  restoreEntity,
} from "../../lib/entity-lifecycle.js";
import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type {
  AccountArchivableEntityConfig,
  ArchivableEntityConfig,
  DeletableEntityConfig,
} from "../../lib/entity-lifecycle.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/account-ownership.js", () => ({
  assertAccountOwnership: vi.fn(),
}));

const MOCK_AUTH = makeTestAuth();

const SYSTEM_ID = brandId<SystemId>("sys_test");
const ACCOUNT_ID = MOCK_AUTH.accountId;
const ENTITY_ID = "ent_test-id";

// ── Fake column / config ────────────────────────────────────────

/** Cast a mock value to PgColumn. Same pattern as asDb() in mock-db.ts. */
function asPgColumn(mock: unknown): ArchivableEntityConfig<string>["columns"]["id"] {
  return mock as ArchivableEntityConfig<string>["columns"]["id"];
}

const TEST_CONFIG: ArchivableEntityConfig<string> = {
  table: {} as ArchivableEntityConfig<string>["table"],
  columns: {
    id: asPgColumn("id"),
    systemId: asPgColumn("system_id"),
    archived: asPgColumn("archived"),
    archivedAt: asPgColumn("archived_at"),
    updatedAt: asPgColumn("updated_at"),
    version: asPgColumn("version"),
  },
  entityName: "Test entity",
  archiveEvent: "custom-front.archived",
  restoreEvent: "custom-front.restored",
};

// ── Tests ────────────────────────────────────────────────────────

describe("archiveEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives an existing non-archived entity", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await archiveEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG);

    expect(chain.update).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.archived" }),
    );
  });

  it("calls onArchive callback after successful archive", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const configWithHook = { ...TEST_CONFIG, onArchive };

    await archiveEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, configWithHook);

    expect(onArchive).toHaveBeenCalledWith(chain, SYSTEM_ID, ENTITY_ID);
  });

  it("does not error when onArchive is not provided", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG),
    ).resolves.toBeUndefined();
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // UPDATE.where → chain (for .returning()), then SELECT.where → [] (not found)
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws ALREADY_ARCHIVED when entity is already archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // UPDATE.where → chain (for .returning()), then SELECT.where → entity found
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }));
  });
});

describe("restoreEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores an archived entity and returns mapped result", async () => {
    const rawRow = { id: ENTITY_ID, name: "Restored" };
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([rawRow]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const mapper = (row: Record<string, unknown>) => ({ mapped: String(row["name"]) });

    const result = await restoreEntity(
      db,
      SYSTEM_ID,
      ENTITY_ID,
      MOCK_AUTH,
      audit,
      TEST_CONFIG,
      mapper,
    );

    expect(result).toEqual({ mapped: "Restored" });
    expect(audit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.restored" }),
    );
  });

  it("calls onRestore callback after successful restore", async () => {
    const rawRow = { id: ENTITY_ID, name: "Restored" };
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([rawRow]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const onRestore = vi.fn().mockResolvedValue(undefined);
    const configWithHook = { ...TEST_CONFIG, onRestore };

    await restoreEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, configWithHook, (r) => r);

    expect(onRestore).toHaveBeenCalledWith(chain, SYSTEM_ID, ENTITY_ID);
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // UPDATE.where → chain (for .returning()), then SELECT.where → [] (not found)
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      restoreEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG, (r) => r),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws NOT_ARCHIVED when entity is not archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // UPDATE.where → chain (for .returning()), then SELECT.where → entity found
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      restoreEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, TEST_CONFIG, (r) => r),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }));
  });
});

// ── deleteEntity ─────────────────────────────────────────────────

function asDeletableColumn(mock: unknown): DeletableEntityConfig<string>["columns"]["id"] {
  return mock as DeletableEntityConfig<string>["columns"]["id"];
}

const DELETE_CONFIG: DeletableEntityConfig<string> = {
  table: {} as DeletableEntityConfig<string>["table"],
  columns: {
    id: asDeletableColumn("id"),
    systemId: asDeletableColumn("system_id"),
    archived: asDeletableColumn("archived"),
  },
  entityName: "Test entity",
  deleteEvent: "custom-front.archived",
};

describe("deleteEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes an existing non-archived entity and writes audit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, DELETE_CONFIG);

    expect(chain.delete).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.archived" }),
    );
  });

  it("calls onDelete hook after audit when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const configWithHook = { ...DELETE_CONFIG, onDelete };

    await deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, configWithHook);

    expect(onDelete).toHaveBeenCalledWith(chain, SYSTEM_ID, ENTITY_ID);
  });

  it("calls checkDependents when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const checkDependents = vi.fn().mockResolvedValue(undefined);
    const configWithCheck = { ...DELETE_CONFIG, checkDependents };

    await deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, configWithCheck);

    expect(checkDependents).toHaveBeenCalledWith(chain, SYSTEM_ID, ENTITY_ID);
    expect(chain.delete).toHaveBeenCalled();
  });

  it("does not error when optional hooks are not provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, DELETE_CONFIG),
    ).resolves.toBeUndefined();
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db } = mockDb();
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, DELETE_CONFIG),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("propagates error when checkDependents throws", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const checkDependents = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("HAS_DEPENDENTS"), { status: 409, code: "HAS_DEPENDENTS" }),
      );
    const configWithCheck = { ...DELETE_CONFIG, checkDependents };

    await expect(
      deleteEntity(db, SYSTEM_ID, ENTITY_ID, MOCK_AUTH, audit, configWithCheck),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }));
  });
});

// ── Account-scoped archive / restore ────────────────────────────

function asAccountPgColumn(mock: unknown): AccountArchivableEntityConfig<string>["columns"]["id"] {
  return mock as AccountArchivableEntityConfig<string>["columns"]["id"];
}

const ACCOUNT_CONFIG: AccountArchivableEntityConfig<string> = {
  table: {} as AccountArchivableEntityConfig<string>["table"],
  columns: {
    id: asAccountPgColumn("id"),
    accountId: asAccountPgColumn("account_id"),
    archived: asAccountPgColumn("archived"),
    archivedAt: asAccountPgColumn("archived_at"),
    updatedAt: asAccountPgColumn("updated_at"),
    version: asAccountPgColumn("version"),
  },
  entityName: "Test account entity",
  archiveEvent: "custom-front.archived",
  restoreEvent: "custom-front.restored",
};

describe("archiveAccountEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives an existing non-archived account-scoped entity", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await archiveAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG);

    expect(chain.update).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.archived" }),
    );
  });

  it("calls onArchive callback after successful archive", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const configWithHook = { ...ACCOUNT_CONFIG, onArchive };

    await archiveAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, configWithHook);

    expect(onArchive).toHaveBeenCalledWith(chain, ACCOUNT_ID, ENTITY_ID);
  });

  it("does not error when onArchive is not provided", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG),
    ).resolves.toBeUndefined();
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws ALREADY_ARCHIVED when entity is already archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      archiveAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }));
  });
});

describe("restoreAccountEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores an archived account-scoped entity and returns mapped result", async () => {
    const rawRow = { id: ENTITY_ID, name: "Restored" };
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([rawRow]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const mapper = (row: Record<string, unknown>) => ({ mapped: String(row["name"]) });

    const result = await restoreAccountEntity(
      db,
      ACCOUNT_ID,
      ENTITY_ID,
      MOCK_AUTH,
      audit,
      ACCOUNT_CONFIG,
      mapper,
    );

    expect(result).toEqual({ mapped: "Restored" });
    expect(audit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.restored" }),
    );
  });

  it("calls onRestore callback after successful restore", async () => {
    const rawRow = { id: ENTITY_ID, name: "Restored" };
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([rawRow]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;
    const onRestore = vi.fn().mockResolvedValue(undefined);
    const configWithHook = { ...ACCOUNT_CONFIG, onRestore };

    await restoreAccountEntity(
      db,
      ACCOUNT_ID,
      ENTITY_ID,
      MOCK_AUTH,
      audit,
      configWithHook,
      (r) => r,
    );

    expect(onRestore).toHaveBeenCalledWith(chain, ACCOUNT_ID, ENTITY_ID);
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      restoreAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG, (r) => r),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws NOT_ARCHIVED when entity is not archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ id: ENTITY_ID }]);
    const audit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

    await expect(
      restoreAccountEntity(db, ACCOUNT_ID, ENTITY_ID, MOCK_AUTH, audit, ACCOUNT_CONFIG, (r) => r),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }));
  });
});
