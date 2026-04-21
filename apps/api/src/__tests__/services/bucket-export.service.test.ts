import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { BucketContentEntityType, BucketId, SystemId, UnixMillis } from "@pluralscape/types";

// ── Mock data ───────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const BUCKET_ID = brandId<BucketId>("bkt_test-bucket");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });

const MOCK_MANIFEST_COUNT = { count: 5, maxUpdatedAt: 2000 as UnixMillis | null };
const MOCK_EXPORT_ROW = {
  id: "mem_test-entity",
  encryptedData: new Uint8Array([1, 2, 3]),
  updatedAt: 1500 as UnixMillis,
};

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../services/bucket/internal.js", () => ({
  assertBucketExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({}),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_test" })),
}));

vi.mock("../../lib/encrypted-blob.js", () => ({
  encryptedBlobToBase64: vi.fn(() => "dGVzdA=="),
}));

vi.mock("../../lib/etag.js", () => ({
  computeManifestEtag: vi.fn(() => "manifest-etag-123"),
  computeDataEtag: vi.fn(() => "data-etag-456"),
}));

vi.mock("../../lib/pagination.js", () => ({
  fromCompositeCursor: vi.fn(() => ({ sortValue: 1000, id: "test-id" })),
  toCompositeCursor: vi.fn(() => "cursor-abc"),
}));

vi.mock("../../lib/batch.js", () => ({
  batchedManifestQueries: vi.fn((fns: (() => Promise<unknown>)[]) =>
    Promise.all(fns.map((fn) => fn())),
  ),
}));

const mockQueryManifestCount = vi.fn().mockResolvedValue(MOCK_MANIFEST_COUNT);
const mockQueryBucketExportRows = vi.fn().mockResolvedValue([]);

vi.mock("../../services/bucket-export.constants.js", () => ({
  BUCKET_EXPORT_TABLE_REGISTRY: new Proxy(
    {},
    {
      get: () => ({
        queryManifestCount: mockQueryManifestCount,
        queryBucketExportRows: mockQueryBucketExportRows,
      }),
      ownKeys: () => ["member", "custom_front"],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    },
  ),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { assertBucketExists } = await import("../../services/bucket/internal.js");

const { getBucketExportManifest, getBucketExportPage } =
  await import("../../services/bucket-export.service.js");

// ── Tests ────────────────────────────────────────────────────────────

describe("bucket-export service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockQueryManifestCount.mockReset().mockResolvedValue(MOCK_MANIFEST_COUNT);
    mockQueryBucketExportRows.mockReset().mockResolvedValue([]);
  });

  // ── getBucketExportManifest ───────────────────────────────────────

  describe("getBucketExportManifest", () => {
    it("returns manifest with entries and etag", async () => {
      const result = await getBucketExportManifest({} as never, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.bucketId).toBe(BUCKET_ID);
      expect(result.entries).toHaveLength(2); // member + custom_front from mock registry
      expect(result.etag).toBe("manifest-etag-123");
    });

    it("calls assertBucketExists", async () => {
      await getBucketExportManifest({} as never, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(assertBucketExists).toHaveBeenCalledWith({}, SYSTEM_ID, BUCKET_ID);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        getBucketExportManifest({} as never, SYSTEM_ID, BUCKET_ID, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });

    it("queries manifest count for each entity type", async () => {
      await getBucketExportManifest({} as never, SYSTEM_ID, BUCKET_ID, AUTH);

      // 2 entity types in our mock registry
      expect(mockQueryManifestCount).toHaveBeenCalledTimes(2);
    });
  });

  // ── getBucketExportPage ───────────────────────────────────────────

  describe("getBucketExportPage", () => {
    const ENTITY_TYPE: BucketContentEntityType = "member";
    const LIMIT = 10;

    it("returns empty page when no rows", async () => {
      mockQueryBucketExportRows.mockResolvedValueOnce([]);

      const result = await getBucketExportPage(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns items with encrypted data", async () => {
      mockQueryBucketExportRows.mockResolvedValueOnce([MOCK_EXPORT_ROW]);

      const result = await getBucketExportPage(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.entityType).toBe(ENTITY_TYPE);
      expect(result.data[0]?.encryptedData).toBe("dGVzdA==");
    });

    it("indicates hasMore when rows exceed limit", async () => {
      const rows = Array.from({ length: LIMIT + 1 }, (_, i) => ({
        ...MOCK_EXPORT_ROW,
        id: `mem_test-${String(i)}`,
      }));
      mockQueryBucketExportRows.mockResolvedValueOnce(rows);

      const result = await getBucketExportPage(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("cursor-abc");
      expect(result.data).toHaveLength(LIMIT);
    });

    it("decodes cursor when provided", async () => {
      const { fromCompositeCursor } = await import("../../lib/pagination.js");
      mockQueryBucketExportRows.mockResolvedValueOnce([]);

      await getBucketExportPage(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
        "some-cursor",
      );

      expect(fromCompositeCursor).toHaveBeenCalledWith("some-cursor", "bucket-export");
    });

    it("calls assertBucketExists before querying", async () => {
      await getBucketExportPage({} as never, SYSTEM_ID, BUCKET_ID, AUTH, ENTITY_TYPE, LIMIT);

      expect(assertBucketExists).toHaveBeenCalledWith({}, SYSTEM_ID, BUCKET_ID);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        getBucketExportPage({} as never, SYSTEM_ID, BUCKET_ID, AUTH, ENTITY_TYPE, LIMIT),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });
});
