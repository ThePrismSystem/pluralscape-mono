import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PAGE_LIMIT } from "../../service.constants.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { BucketId, SystemId } from "@pluralscape/types";

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
  deleteEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

/**
 * Queue of values returned when mockTx is awaited directly (thenable resolution).
 * Each `await tx.select().from().where()` or `await tx...for("update")` pops the
 * front value. Falls back to empty array when exhausted.
 */
const thenableQueue: unknown[][] = [];

interface MockTx {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  for: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  then?: (resolve?: (v: unknown) => unknown) => Promise<unknown>;
}

const mockTx: MockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  for: vi.fn(),
  orderBy: vi.fn(),
  execute: vi.fn(),
};

function wireChain(): void {
  thenableQueue.length = 0;
  mockTx.then = (resolve?: (v: unknown) => unknown) => {
    const val = thenableQueue.shift() ?? [];
    return Promise.resolve(val).then(resolve);
  };

  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
  mockTx.for.mockReturnValue(mockTx);
  mockTx.orderBy.mockReturnValue(mockTx);
  mockTx.execute.mockResolvedValue(undefined);
}

const SYSTEM_ID = "sys_test-system" as SystemId;

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    (_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_test" })),
}));

vi.mock("@pluralscape/db/pg", () => ({
  buckets: {
    id: "id",
    systemId: "system_id",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  systems: {
    id: "id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("bkt_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => ["or", ...args]),
    desc: vi.fn((a: unknown) => ["desc", a]),
    count: vi.fn(() => ({ count: "count" })),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, deleteEntity, restoreEntity } =
  await import("../../lib/entity-lifecycle.js");

const {
  createBucket,
  getBucket,
  listBuckets,
  updateBucket,
  deleteBucket,
  archiveBucket,
  restoreBucket,
  assertBucketExists,
  parseBucketQuery,
} = await import("../../services/bucket.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const BUCKET_ID = "bkt_test-bucket" as BucketId;
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeBucketRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: BUCKET_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("bucket service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  // Wire up the mock chain before each test
  wireChain();

  // ── assertBucketExists ────────────────────────────────────────────

  describe("assertBucketExists", () => {
    it("resolves when bucket exists", async () => {
      mockTx.limit.mockResolvedValueOnce([{ id: BUCKET_ID }]);

      await expect(
        assertBucketExists(mockTx as never, SYSTEM_ID, BUCKET_ID),
      ).resolves.toBeUndefined();
    });

    it("throws NOT_FOUND when bucket is missing", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      await expect(assertBucketExists(mockTx as never, SYSTEM_ID, BUCKET_ID)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── createBucket ──────────────────────────────────────────────────

  describe("createBucket", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64 };

    it("creates a bucket and returns result", async () => {
      // 1st await: for("update") lock row — resolves via thenable queue
      // 2nd await: count query — resolves via thenable queue
      thenableQueue.push([], [{ count: 0 }]);
      mockTx.returning.mockResolvedValueOnce([makeBucketRow()]);

      const result = await createBucket({} as never, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(BUCKET_ID);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "bucket.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      await expect(
        createBucket({} as never, SYSTEM_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws QUOTA_EXCEEDED when at max buckets", async () => {
      thenableQueue.push([], [{ count: 100 }]);

      await expect(
        createBucket({} as never, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "QUOTA_EXCEEDED" }));
    });

    it("throws if INSERT returns no rows", async () => {
      thenableQueue.push([], [{ count: 0 }]);
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        createBucket({} as never, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow("Failed to create bucket");
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createBucket({} as never, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── getBucket ─────────────────────────────────────────────────────

  describe("getBucket", () => {
    it("returns bucket when found", async () => {
      mockTx.limit.mockResolvedValueOnce([makeBucketRow()]);

      const result = await getBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH);
      expect(result.id).toBe(BUCKET_ID);
    });

    it("throws NOT_FOUND when bucket is missing", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      await expect(getBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  // ── listBuckets ───────────────────────────────────────────────────

  describe("listBuckets", () => {
    it("returns paginated result", async () => {
      mockTx.limit.mockResolvedValueOnce([makeBucketRow()]);

      const result = await listBuckets({} as never, SYSTEM_ID, AUTH);
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no buckets", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await listBuckets({} as never, SYSTEM_ID, AUTH);
      expect(result.data).toHaveLength(0);
    });

    it("clamps limit to MAX_PAGE_LIMIT", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      await listBuckets({} as never, SYSTEM_ID, AUTH, { limit: 9999 });
      expect(mockTx.limit).toHaveBeenCalledWith(MAX_PAGE_LIMIT + 1);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listBuckets({} as never, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  // ── updateBucket ──────────────────────────────────────────────────

  describe("updateBucket", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates and returns result", async () => {
      mockTx.returning.mockResolvedValueOnce([makeBucketRow({ version: 2, updatedAt: 2000 })]);

      const result = await updateBucket(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        validPayload,
        AUTH,
        mockAudit,
      );
      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "bucket.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      await expect(
        updateBucket({} as never, SYSTEM_ID, BUCKET_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws CONFLICT on version mismatch when entity exists", async () => {
      mockTx.returning.mockResolvedValueOnce([]);
      // exists check
      mockTx.limit.mockResolvedValueOnce([{ id: BUCKET_ID }]);

      await expect(
        updateBucket({} as never, SYSTEM_ID, BUCKET_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when entity does not exist", async () => {
      mockTx.returning.mockResolvedValueOnce([]);
      mockTx.limit.mockResolvedValueOnce([]);

      await expect(
        updateBucket({} as never, SYSTEM_ID, BUCKET_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── deleteBucket ──────────────────────────────────────────────────

  describe("deleteBucket", () => {
    it("delegates to deleteEntity", async () => {
      await deleteBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH, mockAudit);

      expect(deleteEntity).toHaveBeenCalledWith(
        {},
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        mockAudit,
        expect.objectContaining({ entityName: "Bucket" }),
      );
    });
  });

  // ── archiveBucket ─────────────────────────────────────────────────

  describe("archiveBucket", () => {
    it("delegates to archiveEntity", async () => {
      await archiveBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        {},
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        mockAudit,
        expect.objectContaining({
          entityName: "Bucket",
          archiveEvent: "bucket.archived",
        }),
      );
    });
  });

  // ── restoreBucket ─────────────────────────────────────────────────

  describe("restoreBucket", () => {
    it("delegates to restoreEntity", async () => {
      await restoreBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH, mockAudit);

      expect(restoreEntity).toHaveBeenCalledWith(
        {},
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        mockAudit,
        expect.objectContaining({
          entityName: "Bucket",
          restoreEvent: "bucket.restored",
        }),
        expect.any(Function),
      );
    });
  });

  // ── parseBucketQuery ──────────────────────────────────────────────

  describe("parseBucketQuery", () => {
    it("parses includeArchived from query", () => {
      const result = parseBucketQuery({ includeArchived: "true" });
      expect(result.includeArchived).toBe(true);
    });

    it("defaults includeArchived to false", () => {
      const result = parseBucketQuery({});
      expect(result.includeArchived).toBe(false);
    });
  });
});
