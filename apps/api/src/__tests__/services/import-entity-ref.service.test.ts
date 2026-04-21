import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { MockChain } from "../helpers/mock-db.js";
import type {
  AccountId,
  ImportEntityRefId,
  ImportEntityType,
  ImportSourceFormat,
  SystemId,
} from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_ier-test");

const mockTx: MockChain & { onConflictDoUpdate: ReturnType<typeof vi.fn> } = {
  select: vi.fn(),
  from: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  for: vi.fn(),
  onConflictDoNothing: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  groupBy: vi.fn(),
  having: vi.fn(),
  execute: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.leftJoin.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.orderBy.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
  mockTx.delete.mockReturnValue(mockTx);
  mockTx.for.mockReturnValue(mockTx);
  mockTx.onConflictDoNothing.mockReturnValue(mockTx);
  mockTx.onConflictDoUpdate.mockResolvedValue([]);
  mockTx.groupBy.mockResolvedValue([]);
  mockTx.execute.mockResolvedValue(undefined);
}

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    (_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_ier-test" })),
}));

vi.mock("@pluralscape/db/pg", () => ({
  importEntityRefs: {
    id: "id",
    accountId: "account_id",
    systemId: "system_id",
    source: "source",
    sourceEntityType: "source_entity_type",
    sourceEntityId: "source_entity_id",
    pluralscapeEntityId: "pluralscape_entity_id",
    importedAt: "imported_at",
  },
}));

// ── Import under test ────────────────────────────────────────────────

const { lookupImportEntityRef, lookupImportEntityRefBatch } =
  await import("../../services/import-entity-ref/lookup.js");
const { upsertImportEntityRefBatch } =
  await import("../../services/import-entity-ref/upsert-batch.js");
const { recordImportEntityRef } = await import("../../services/import-entity-ref/record.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { asDb } = await import("../helpers/mock-db.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH = makeTestAuth({
  accountId: "acct_ier-test",
  systemId: SYSTEM_ID,
  sessionId: "sess_ier-test",
});

const DB = asDb(mockTx);
const SOURCE: ImportSourceFormat = "simply-plural";

function makeRefRow(
  sourceEntityType: ImportEntityType,
  pluralscapeEntityId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: brandId<ImportEntityRefId>("ier_test-row-001"),
    accountId: brandId<AccountId>("acct_ier-test"),
    systemId: SYSTEM_ID,
    source: SOURCE,
    sourceEntityType,
    sourceEntityId: "src_001",
    pluralscapeEntityId,
    importedAt: 1700000000000,
    ...overrides,
  };
}

// ── toResult via lookupImportEntityRef ───────────────────────────────

/**
 * Each ImportEntityType must be handled in the toResult switch. We test
 * every branch by calling lookupImportEntityRef, which delegates to
 * toResult internally.
 */

const BRANDED_ENTITY_TYPES: ReadonlyArray<{
  type: ImportEntityType;
  targetId: string;
}> = [
  { type: "member", targetId: "mbr_test-id" },
  { type: "group", targetId: "grp_test-id" },
  { type: "fronting-session", targetId: "frs_test-id" },
  { type: "custom-field", targetId: "fld_test-id" },
  { type: "note", targetId: "nte_test-id" },
  { type: "chat-message", targetId: "msg_test-id" },
  { type: "board-message", targetId: "bms_test-id" },
  { type: "poll", targetId: "pol_test-id" },
  { type: "timer", targetId: "tmr_test-id" },
  { type: "privacy-bucket", targetId: "bkt_test-id" },
  { type: "custom-front", targetId: "cfr_test-id" },
  { type: "fronting-comment", targetId: "frc_test-id" },
  { type: "field-definition", targetId: "fld_test-id" },
  { type: "field-value", targetId: "flv_test-id" },
  { type: "journal-entry", targetId: "jne_test-id" },
  { type: "channel-category", targetId: "chn_test-id" },
  { type: "channel", targetId: "chn_test-id" },
  { type: "system-profile", targetId: "sys_test-id" },
  { type: "system-settings", targetId: "sys_test-id" },
];

const PASSTHROUGH_ENTITY_TYPES: ReadonlyArray<{
  type: ImportEntityType;
  targetId: string;
}> = [
  { type: "switch", targetId: "raw-switch-id" },
  { type: "unknown", targetId: "raw-unknown-id" },
];

describe("toResult — branded entity types", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it.each(BRANDED_ENTITY_TYPES)(
    "handles $type with assertBrandedTargetId",
    async ({ type, targetId }) => {
      wireChain();
      const row = makeRefRow(type, targetId);
      mockTx.limit.mockResolvedValueOnce([row]);

      const result = await lookupImportEntityRef(
        DB,
        SYSTEM_ID,
        { source: SOURCE, sourceEntityType: type, sourceEntityId: "src_001" },
        AUTH,
      );

      if (result === null) {
        expect.unreachable("expected non-null result");
      }
      expect(result.sourceEntityType).toBe(type);
      expect(result.pluralscapeEntityId).toBe(targetId);
      expect(result.importedAt).toBe(1700000000000);
    },
  );
});

describe("toResult — passthrough entity types (switch, unknown)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it.each(PASSTHROUGH_ENTITY_TYPES)(
    "handles $type with raw passthrough",
    async ({ type, targetId }) => {
      wireChain();
      const row = makeRefRow(type, targetId);
      mockTx.limit.mockResolvedValueOnce([row]);

      const result = await lookupImportEntityRef(
        DB,
        SYSTEM_ID,
        { source: SOURCE, sourceEntityType: type, sourceEntityId: "src_001" },
        AUTH,
      );

      if (result === null) {
        expect.unreachable("expected non-null result");
      }
      expect(result.sourceEntityType).toBe(type);
      expect(result.pluralscapeEntityId).toBe(targetId);
    },
  );
});

describe("lookupImportEntityRef", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it("returns null when no row matches", async () => {
    wireChain();
    mockTx.limit.mockResolvedValueOnce([]);

    const result = await lookupImportEntityRef(
      DB,
      SYSTEM_ID,
      { source: SOURCE, sourceEntityType: "member", sourceEntityId: "src_missing" },
      AUTH,
    );

    expect(result).toBeNull();
  });

  it("throws 404 for system ownership failure", async () => {
    wireChain();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      lookupImportEntityRef(
        DB,
        SYSTEM_ID,
        { source: SOURCE, sourceEntityType: "member", sourceEntityId: "src_001" },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── lookupImportEntityRefBatch ───────────────────────────────────────

describe("lookupImportEntityRefBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it("returns empty map for empty sourceEntityIds", async () => {
    wireChain();

    const result = await lookupImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      { source: SOURCE, sourceEntityType: "member", sourceEntityIds: [] },
      AUTH,
    );

    expect(result.size).toBe(0);
  });

  it("returns populated map for matching rows", async () => {
    wireChain();
    mockTx.where.mockResolvedValueOnce([
      { sourceEntityId: "src_a", pluralscapeEntityId: "mbr_target-a" },
      { sourceEntityId: "src_b", pluralscapeEntityId: "mbr_target-b" },
    ]);

    const result = await lookupImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      { source: SOURCE, sourceEntityType: "member", sourceEntityIds: ["src_a", "src_b", "src_c"] },
      AUTH,
    );

    expect(result.size).toBe(2);
    expect(result.get("src_a")).toBe("mbr_target-a");
    expect(result.get("src_b")).toBe("mbr_target-b");
    expect(result.has("src_c")).toBe(false);
  });
});

// ── upsertImportEntityRefBatch ───────────────────────────────────────

describe("upsertImportEntityRefBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it("returns zero counts for empty entries", async () => {
    wireChain();

    const result = await upsertImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      { source: SOURCE, entries: [] },
      AUTH,
    );

    expect(result).toEqual({ upserted: 0, unchanged: 0 });
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it("throws 400 for empty sourceEntityId in entry", async () => {
    wireChain();

    await expect(
      upsertImportEntityRefBatch(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          entries: [
            { sourceEntityType: "member", sourceEntityId: "", pluralscapeEntityId: "mbr_target" },
          ],
        },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for empty pluralscapeEntityId in entry", async () => {
    wireChain();

    await expect(
      upsertImportEntityRefBatch(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          entries: [
            { sourceEntityType: "member", sourceEntityId: "src_001", pluralscapeEntityId: "" },
          ],
        },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("reports all unchanged when every entry matches existing mapping", async () => {
    wireChain();
    // Pre-upsert snapshot returns existing rows with same target IDs
    mockTx.where.mockResolvedValueOnce([
      {
        sourceEntityType: "member",
        sourceEntityId: "src_001",
        pluralscapeEntityId: "mbr_target-1",
      },
      {
        sourceEntityType: "member",
        sourceEntityId: "src_002",
        pluralscapeEntityId: "mbr_target-2",
      },
    ]);
    // upsert chain: insert().values().onConflictDoUpdate()
    mockTx.onConflictDoUpdate.mockResolvedValueOnce([]);

    const result = await upsertImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_001",
            pluralscapeEntityId: "mbr_target-1",
          },
          {
            sourceEntityType: "member",
            sourceEntityId: "src_002",
            pluralscapeEntityId: "mbr_target-2",
          },
        ],
      },
      AUTH,
    );

    expect(result).toEqual({ upserted: 0, unchanged: 2 });
  });

  it("reports mixed upserted and unchanged counts", async () => {
    wireChain();
    // Pre-upsert snapshot: only src_001 exists with same target
    mockTx.where.mockResolvedValueOnce([
      {
        sourceEntityType: "member",
        sourceEntityId: "src_001",
        pluralscapeEntityId: "mbr_target-1",
      },
    ]);
    // upsert chain
    mockTx.onConflictDoUpdate.mockResolvedValueOnce([]);

    const result = await upsertImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_001",
            pluralscapeEntityId: "mbr_target-1",
          },
          {
            sourceEntityType: "member",
            sourceEntityId: "src_002",
            pluralscapeEntityId: "mbr_target-2",
          },
          {
            sourceEntityType: "group",
            sourceEntityId: "src_003",
            pluralscapeEntityId: "grp_target-3",
          },
        ],
      },
      AUTH,
    );

    expect(result).toEqual({ upserted: 2, unchanged: 1 });
  });

  it("reports all upserted when no pre-existing rows", async () => {
    wireChain();
    // Pre-upsert snapshot: no existing rows
    mockTx.where.mockResolvedValueOnce([]);
    // upsert chain
    mockTx.onConflictDoUpdate.mockResolvedValueOnce([]);

    const result = await upsertImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_001",
            pluralscapeEntityId: "mbr_target-1",
          },
        ],
      },
      AUTH,
    );

    expect(result).toEqual({ upserted: 1, unchanged: 0 });
  });

  it("counts existing row with different target as upserted", async () => {
    wireChain();
    // Pre-upsert snapshot: src_001 exists but with different target
    mockTx.where.mockResolvedValueOnce([
      {
        sourceEntityType: "member",
        sourceEntityId: "src_001",
        pluralscapeEntityId: "mbr_old-target",
      },
    ]);
    mockTx.onConflictDoUpdate.mockResolvedValueOnce([]);

    const result = await upsertImportEntityRefBatch(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_001",
            pluralscapeEntityId: "mbr_new-target",
          },
        ],
      },
      AUTH,
    );

    expect(result).toEqual({ upserted: 1, unchanged: 0 });
  });
});

// ── recordImportEntityRef ────────────────────────────────────────────

describe("recordImportEntityRef", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    wireChain();
  });

  it("returns newly inserted row on success", async () => {
    wireChain();
    const insertedRow = makeRefRow("member", "mbr_target-new");
    mockTx.returning.mockResolvedValueOnce([insertedRow]);

    const result = await recordImportEntityRef(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        sourceEntityType: "member",
        sourceEntityId: "src_new",
        pluralscapeEntityId: "mbr_target-new",
      },
      AUTH,
    );

    expect(result.sourceEntityType).toBe("member");
    expect(result.pluralscapeEntityId).toBe("mbr_target-new");
  });

  it("throws 400 for empty sourceEntityId", async () => {
    wireChain();

    await expect(
      recordImportEntityRef(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          sourceEntityType: "member",
          sourceEntityId: "",
          pluralscapeEntityId: "mbr_target",
        },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for empty pluralscapeEntityId", async () => {
    wireChain();

    await expect(
      recordImportEntityRef(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          sourceEntityType: "member",
          sourceEntityId: "src_001",
          pluralscapeEntityId: "",
        },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("returns existing row on idempotent conflict (same target)", async () => {
    wireChain();
    // INSERT returns empty (conflict, onConflictDoNothing)
    mockTx.returning.mockResolvedValueOnce([]);
    // Fetch existing row — same pluralscapeEntityId
    const existingRow = makeRefRow("member", "mbr_same-target", {
      sourceEntityId: "src_existing",
    });
    mockTx.limit.mockResolvedValueOnce([existingRow]);

    const result = await recordImportEntityRef(
      DB,
      SYSTEM_ID,
      {
        source: SOURCE,
        sourceEntityType: "member",
        sourceEntityId: "src_existing",
        pluralscapeEntityId: "mbr_same-target",
      },
      AUTH,
    );

    expect(result.sourceEntityType).toBe("member");
    expect(result.pluralscapeEntityId).toBe("mbr_same-target");
  });

  it("throws 409 on divergent conflict (different target)", async () => {
    wireChain();
    // INSERT returns empty (conflict)
    mockTx.returning.mockResolvedValueOnce([]);
    // Fetch existing row — different pluralscapeEntityId
    const existingRow = makeRefRow("member", "mbr_different-target", {
      sourceEntityId: "src_conflict",
    });
    mockTx.limit.mockResolvedValueOnce([existingRow]);

    await expect(
      recordImportEntityRef(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          sourceEntityType: "member",
          sourceEntityId: "src_conflict",
          pluralscapeEntityId: "mbr_wanted-target",
        },
        AUTH,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "CONFLICT",
        message: expect.stringContaining("already mapped"),
      }),
    );
  });

  it("throws 500 on race condition (insert skipped, no row found)", async () => {
    wireChain();
    // INSERT returns empty (conflict)
    mockTx.returning.mockResolvedValueOnce([]);
    // Fetch existing row returns nothing (race condition)
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      recordImportEntityRef(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          sourceEntityType: "member",
          sourceEntityId: "src_race",
          pluralscapeEntityId: "mbr_target-race",
        },
        AUTH,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        code: "INTERNAL_ERROR",
        message: expect.stringContaining("Race detected"),
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    wireChain();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      recordImportEntityRef(
        DB,
        SYSTEM_ID,
        {
          source: SOURCE,
          sourceEntityType: "member",
          sourceEntityId: "src_001",
          pluralscapeEntityId: "mbr_target",
        },
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
