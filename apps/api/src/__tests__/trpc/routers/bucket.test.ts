import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { AccountId, BucketId, FriendConnectionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/bucket.service.js", () => ({
  createBucket: vi.fn(),
  getBucket: vi.fn(),
  listBuckets: vi.fn(),
  updateBucket: vi.fn(),
  deleteBucket: vi.fn(),
  archiveBucket: vi.fn(),
  restoreBucket: vi.fn(),
}));

vi.mock("../../../services/bucket-assignment.service.js", () => ({
  assignBucketToFriend: vi.fn(),
  unassignBucketFromFriend: vi.fn(),
  listFriendBucketAssignments: vi.fn(),
}));

vi.mock("../../../services/bucket-content-tag.service.js", () => ({
  tagContent: vi.fn(),
  untagContent: vi.fn(),
  listTagsByBucket: vi.fn(),
}));

vi.mock("../../../services/bucket-export.service.js", () => ({
  getBucketExportManifest: vi.fn(),
  getBucketExportPage: vi.fn(),
}));

const {
  createBucket,
  getBucket,
  listBuckets,
  updateBucket,
  deleteBucket,
  archiveBucket,
  restoreBucket,
} = await import("../../../services/bucket.service.js");

const { assignBucketToFriend, unassignBucketFromFriend, listFriendBucketAssignments } =
  await import("../../../services/bucket-assignment.service.js");

const { tagContent, untagContent, listTagsByBucket } =
  await import("../../../services/bucket-content-tag.service.js");

const { getBucketExportManifest, getBucketExportPage } =
  await import("../../../services/bucket-export.service.js");

const { bucketRouter } = await import("../../../trpc/routers/bucket.js");

const createCaller = makeCallerFactory({ bucket: bucketRouter });

const BUCKET_ID = "bkt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as BucketId;
const CONNECTION_ID = "fc_11111111-2222-3333-4444-555555555555" as FriendConnectionId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JidWNrZXQ=";

const MOCK_BUCKET_RESULT = {
  id: BUCKET_ID,
  systemId: SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const MOCK_PAGINATED = {
  data: [MOCK_BUCKET_RESULT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("bucket router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("bucket.create", () => {
    it("calls createBucket with correct systemId and returns result", async () => {
      vi.mocked(createBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
      const caller = createCaller();
      const result = await caller.bucket.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(createBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.bucket.create({ systemId: SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.bucket.create({ systemId: foreignSystemId, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("bucket.get", () => {
    it("calls getBucket with correct systemId and bucketId", async () => {
      vi.mocked(getBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
      const caller = createCaller();
      const result = await caller.bucket.get({ systemId: SYSTEM_ID, bucketId: BUCKET_ID });

      expect(vi.mocked(getBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });

    it("rejects invalid bucketId format", async () => {
      const caller = createCaller();
      await expect(
        caller.bucket.get({ systemId: SYSTEM_ID, bucketId: "not-a-bucket-id" as BucketId }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBucket).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(caller.bucket.get({ systemId: SYSTEM_ID, bucketId: BUCKET_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("bucket.list", () => {
    it("calls listBuckets and returns result", async () => {
      vi.mocked(listBuckets).mockResolvedValue(MOCK_PAGINATED);
      const caller = createCaller();
      const result = await caller.bucket.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listBuckets)).toHaveBeenCalledOnce();
      expect(vi.mocked(listBuckets).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_PAGINATED);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listBuckets).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.bucket.list({
        systemId: SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listBuckets).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("bucket.update", () => {
    it("calls updateBucket with correct systemId and bucketId", async () => {
      vi.mocked(updateBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
      const caller = createCaller();
      const result = await caller.bucket.update({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateBucket).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.update({
          systemId: SYSTEM_ID,
          bucketId: BUCKET_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("bucket.archive", () => {
    it("calls archiveBucket and returns success", async () => {
      vi.mocked(archiveBucket).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.bucket.archive({ systemId: SYSTEM_ID, bucketId: BUCKET_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveBucket).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.archive({ systemId: SYSTEM_ID, bucketId: BUCKET_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("bucket.restore", () => {
    it("calls restoreBucket and returns result", async () => {
      vi.mocked(restoreBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
      const caller = createCaller();
      const result = await caller.bucket.restore({ systemId: SYSTEM_ID, bucketId: BUCKET_ID });

      expect(vi.mocked(restoreBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("bucket.delete", () => {
    it("calls deleteBucket and returns success", async () => {
      vi.mocked(deleteBucket).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.bucket.delete({ systemId: SYSTEM_ID, bucketId: BUCKET_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when dependents exist", async () => {
      vi.mocked(deleteBucket).mockRejectedValue(
        new ApiHttpError(409, "HAS_DEPENDENTS", "Bucket has dependents"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.delete({ systemId: SYSTEM_ID, bucketId: BUCKET_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── error mapping ─────────────────────────────────────────────────

  describe("error mapping", () => {
    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createBucket).mockRejectedValue(
        new ApiHttpError(400, "QUOTA_EXCEEDED", "Max buckets reached"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.create({ systemId: SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── assignFriend ──────────────────────────────────────────────────

  describe("bucket.assignFriend", () => {
    it("calls assignBucketToFriend with correct args", async () => {
      const mockResult = {
        friendConnectionId: CONNECTION_ID,
        bucketId: BUCKET_ID,
        friendAccountId: "acct_friend001" as AccountId,
      };
      vi.mocked(assignBucketToFriend).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.assignFriend({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        connectionId: CONNECTION_ID,
        encryptedBucketKey: "a2V5ZGF0YQ==",
        keyVersion: 1,
      });

      expect(vi.mocked(assignBucketToFriend)).toHaveBeenCalledOnce();
      expect(vi.mocked(assignBucketToFriend).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(assignBucketToFriend).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── unassignFriend ────────────────────────────────────────────────

  describe("bucket.unassignFriend", () => {
    it("calls unassignBucketFromFriend and returns result", async () => {
      const mockResult = { pendingRotation: { systemId: SYSTEM_ID, bucketId: BUCKET_ID } };
      vi.mocked(unassignBucketFromFriend).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.unassignFriend({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        connectionId: CONNECTION_ID,
      });

      expect(vi.mocked(unassignBucketFromFriend)).toHaveBeenCalledOnce();
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[3]).toBe(CONNECTION_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── listFriendAssignments ─────────────────────────────────────────

  describe("bucket.listFriendAssignments", () => {
    it("calls listFriendBucketAssignments and returns result", async () => {
      const mockResult = [
        {
          friendConnectionId: CONNECTION_ID,
          bucketId: BUCKET_ID,
          friendAccountId: "acct_friend001" as AccountId,
        },
      ];
      vi.mocked(listFriendBucketAssignments).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.listFriendAssignments({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(listFriendBucketAssignments)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFriendBucketAssignments).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(listFriendBucketAssignments).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── tagContent ────────────────────────────────────────────────────

  describe("bucket.tagContent", () => {
    it("calls tagContent with correct args", async () => {
      const mockResult = {
        entityType: "member" as const,
        entityId: "mem_test001",
        bucketId: BUCKET_ID,
      };
      vi.mocked(tagContent).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.tagContent({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        entityId: "mem_test001",
      });

      expect(vi.mocked(tagContent)).toHaveBeenCalledOnce();
      expect(vi.mocked(tagContent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(tagContent).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── untagContent ──────────────────────────────────────────────────

  describe("bucket.untagContent", () => {
    it("calls untagContent with correct args and returns success", async () => {
      vi.mocked(untagContent).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.bucket.untagContent({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        entityId: "mem_test001",
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(untagContent)).toHaveBeenCalledOnce();
      expect(vi.mocked(untagContent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(untagContent).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(untagContent).mock.calls[0]?.[3]).toBe("member");
      expect(vi.mocked(untagContent).mock.calls[0]?.[4]).toBe("mem_test001");
    });
  });

  // ── listTags ──────────────────────────────────────────────────────

  describe("bucket.listTags", () => {
    it("calls listTagsByBucket and returns result", async () => {
      const mockResult = [
        { entityType: "member" as const, entityId: "mem_test001", bucketId: BUCKET_ID },
      ];
      vi.mocked(listTagsByBucket).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.listTags({ systemId: SYSTEM_ID, bucketId: BUCKET_ID });

      expect(vi.mocked(listTagsByBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(listTagsByBucket).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(listTagsByBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── exportManifest ────────────────────────────────────────────────

  describe("bucket.exportManifest", () => {
    it("calls getBucketExportManifest and returns result", async () => {
      const mockResult = {
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        entries: [],
        etag: "etag_abc",
      };
      vi.mocked(getBucketExportManifest).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.exportManifest({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(getBucketExportManifest)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucketExportManifest).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getBucketExportManifest).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── exportPage ────────────────────────────────────────────────────

  describe("bucket.exportPage", () => {
    it("calls getBucketExportPage with correct args", async () => {
      const mockResult = {
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
        etag: "etag_abc",
      };
      vi.mocked(getBucketExportPage).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.exportPage({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        limit: 50,
      });

      expect(vi.mocked(getBucketExportPage)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[4]).toBe("member");
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[5]).toBe(50);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor when provided", async () => {
      vi.mocked(getBucketExportPage).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
        etag: "etag_abc",
      });
      const caller = createCaller();
      await caller.bucket.exportPage({
        systemId: SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        limit: 50,
        cursor: "cur_xyz",
      });

      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[6]).toBe("cur_xyz");
    });
  });
});
