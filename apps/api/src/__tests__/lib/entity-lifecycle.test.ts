import { afterEach, describe, expect, it, vi } from "vitest";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

const MOCK_AUTH = makeTestAuth();

const SYSTEM_ID = "sys_test" as SystemId;
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
