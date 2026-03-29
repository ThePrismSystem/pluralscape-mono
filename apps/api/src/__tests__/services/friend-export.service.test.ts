import { afterEach, describe, expect, it, vi } from "vitest";

import { makeTestAuth } from "../helpers/test-auth.js";

import type {
  BucketId,
  FriendConnectionId,
  FriendExportEntityType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Mock data ───────────────────────────────────────────────────────

const SYSTEM_ID = "sys_target" as SystemId;
const CONNECTION_ID = "fc_test-connection" as FriendConnectionId;
const AUTH = makeTestAuth({ accountId: "acct_test", systemId: "sys_mine" });
const BUCKET_IDS: readonly BucketId[] = ["bkt_1" as BucketId, "bkt_2" as BucketId];

const MOCK_ACCESS = {
  targetSystemId: SYSTEM_ID,
  assignedBucketIds: BUCKET_IDS,
};

const MOCK_KEY_GRANTS = [{ id: "kg_1", bucketId: "bkt_1", encryptedKey: "key1", keyVersion: 1 }];

const MOCK_MANIFEST_COUNT = { count: 3, maxUpdatedAt: 2000 as UnixMillis | null };

const makeExportRow = (id: string, updatedAt: number) => ({
  id,
  encryptedData: new Uint8Array([1, 2, 3]),
  updatedAt: updatedAt as UnixMillis,
});

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/friend-access.js", () => ({
  assertFriendAccess: vi.fn().mockResolvedValue(MOCK_ACCESS),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withCrossAccountRead: vi.fn((_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));

vi.mock("../../lib/encrypted-blob.js", () => ({
  encryptedBlobToBase64: vi.fn(() => "dGVzdA=="),
}));

vi.mock("../../lib/etag.js", () => ({
  computeManifestEtag: vi.fn(() => "manifest-etag"),
  computeDataEtag: vi.fn(() => "data-etag"),
}));

vi.mock("../../lib/pagination.js", () => ({
  fromCompositeCursor: vi.fn(() => ({ sortValue: 1000, id: "cursor-id" })),
  toCompositeCursor: vi.fn(() => "next-cursor"),
}));

vi.mock("../../lib/batch.js", () => ({
  batchedManifestQueries: vi.fn((fns: (() => Promise<unknown>)[]) =>
    Promise.all(fns.map((fn) => fn())),
  ),
}));

vi.mock("../../lib/bucket-access.js", () => ({
  filterVisibleEntities: vi.fn().mockImplementation(
    (rows: { id: string }[]) => rows, // default: all visible
  ),
  loadBucketTags: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../services/friend-dashboard.service.js", () => ({
  queryActiveKeyGrants: vi.fn().mockResolvedValue(MOCK_KEY_GRANTS),
}));

const mockQueryManifestCount = vi.fn().mockResolvedValue(MOCK_MANIFEST_COUNT);
const mockQueryExportRows = vi.fn().mockResolvedValue([]);

vi.mock("../../services/friend-export.constants.js", () => ({
  EXPORT_TABLE_REGISTRY: new Proxy(
    {},
    {
      get: () => ({
        queryManifestCount: mockQueryManifestCount,
        queryExportRows: mockQueryExportRows,
      }),
      ownKeys: () => ["member", "custom_front"],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    },
  ),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertFriendAccess } = await import("../../lib/friend-access.js");
const { filterVisibleEntities } = await import("../../lib/bucket-access.js");

const { getFriendExportManifest, getFriendExportPage } =
  await import("../../services/friend-export.service.js");

// ── Tests ────────────────────────────────────────────────────────────

describe("friend-export service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockQueryManifestCount.mockReset().mockResolvedValue(MOCK_MANIFEST_COUNT);
    mockQueryExportRows.mockReset().mockResolvedValue([]);
  });

  // ── getFriendExportManifest ───────────────────────────────────────

  describe("getFriendExportManifest", () => {
    it("returns manifest with entries, key grants, and etag", async () => {
      const result = await getFriendExportManifest({} as never, CONNECTION_ID, AUTH);

      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.entries).toHaveLength(2);
      expect(result.keyGrants).toEqual(MOCK_KEY_GRANTS);
      expect(result.etag).toBe("manifest-etag");
    });

    it("calls assertFriendAccess with connection and auth", async () => {
      await getFriendExportManifest({} as never, CONNECTION_ID, AUTH);

      expect(assertFriendAccess).toHaveBeenCalledWith({}, CONNECTION_ID, AUTH);
    });

    it("queries manifest count for each entity type", async () => {
      await getFriendExportManifest({} as never, CONNECTION_ID, AUTH);
      expect(mockQueryManifestCount).toHaveBeenCalledTimes(2);
    });

    it("rejects when friend access denied", async () => {
      vi.mocked(assertFriendAccess).mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404, code: "NOT_FOUND" }),
      );

      await expect(getFriendExportManifest({} as never, CONNECTION_ID, AUTH)).rejects.toThrow(
        "Not found",
      );
    });
  });

  // ── getFriendExportPage ───────────────────────────────────────────

  describe("getFriendExportPage", () => {
    const ENTITY_TYPE: FriendExportEntityType = "member";
    const LIMIT = 10;

    it("returns empty page when no bucket IDs assigned", async () => {
      vi.mocked(assertFriendAccess).mockResolvedValueOnce({
        ...MOCK_ACCESS,
        assignedBucketIds: [],
      });

      const result = await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns visible items with encrypted data", async () => {
      const rows = [makeExportRow("mem_1", 1000), makeExportRow("mem_2", 1100)];
      mockQueryExportRows.mockResolvedValueOnce(rows);

      const result = await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.encryptedData).toBe("dGVzdA==");
      expect(result.items[0]?.entityType).toBe(ENTITY_TYPE);
    });

    it("indicates hasMore when visible items exceed limit", async () => {
      const rows = Array.from({ length: LIMIT + 1 }, (_, i) =>
        makeExportRow(`mem_${String(i)}`, 1000 + i),
      );
      // Return full batch from DB (simulates lots of data)
      mockQueryExportRows.mockResolvedValueOnce(rows);

      const result = await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(LIMIT);
      expect(result.nextCursor).toBe("next-cursor");
    });

    it("handles partially visible batches with overfetch loop", async () => {
      // First batch: 30 rows (3x limit=10) but only 5 visible
      const batch1 = Array.from({ length: 30 }, (_, i) =>
        makeExportRow(`mem_${String(i)}`, 1000 + i),
      );
      // Second batch: 30 more rows, all visible
      const batch2 = Array.from({ length: 30 }, (_, i) =>
        makeExportRow(`mem_${String(100 + i)}`, 2000 + i),
      );

      mockQueryExportRows.mockResolvedValueOnce(batch1).mockResolvedValueOnce(batch2);

      // First iteration: only 5 visible
      vi.mocked(filterVisibleEntities)
        .mockReturnValueOnce(batch1.slice(0, 5))
        .mockReturnValueOnce(batch2);

      const result = await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      // Should have fetched twice and accumulated up to limit
      expect(mockQueryExportRows).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(LIMIT);
    });

    it("returns partial page when DB exhausted before filling limit", async () => {
      const rows = [makeExportRow("mem_1", 1000)];
      mockQueryExportRows.mockResolvedValueOnce(rows);

      const result = await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
      );

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("decodes cursor when provided", async () => {
      const { fromCompositeCursor } = await import("../../lib/pagination.js");
      mockQueryExportRows.mockResolvedValueOnce([]);

      await getFriendExportPage(
        {} as never,
        CONNECTION_ID,
        AUTH,
        ENTITY_TYPE,
        LIMIT,
        "some-cursor",
      );

      expect(fromCompositeCursor).toHaveBeenCalledWith("some-cursor", "export");
    });

    it("rejects when friend access denied", async () => {
      vi.mocked(assertFriendAccess).mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404, code: "NOT_FOUND" }),
      );

      await expect(
        getFriendExportPage({} as never, CONNECTION_ID, AUTH, ENTITY_TYPE, LIMIT),
      ).rejects.toThrow("Not found");
    });
  });
});
