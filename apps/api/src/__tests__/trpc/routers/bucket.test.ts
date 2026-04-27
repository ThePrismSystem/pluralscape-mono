import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type {
  EncryptedBase64,
  AccountId,
  BucketId,
  FriendConnectionId,
  MemberId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/bucket/create.js", () => ({
  createBucket: vi.fn(),
}));
vi.mock("../../../services/bucket/get.js", () => ({
  getBucket: vi.fn(),
}));
vi.mock("../../../services/bucket/list.js", () => ({
  listBuckets: vi.fn(),
}));
vi.mock("../../../services/bucket/update.js", () => ({
  updateBucket: vi.fn(),
}));
vi.mock("../../../services/bucket/delete.js", () => ({
  deleteBucket: vi.fn(),
}));
vi.mock("../../../services/bucket/archive.js", () => ({
  archiveBucket: vi.fn(),
}));
vi.mock("../../../services/bucket/restore.js", () => ({
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

const { createBucket } = await import("../../../services/bucket/create.js");
const { getBucket } = await import("../../../services/bucket/get.js");
const { listBuckets } = await import("../../../services/bucket/list.js");
const { updateBucket } = await import("../../../services/bucket/update.js");
const { deleteBucket } = await import("../../../services/bucket/delete.js");
const { archiveBucket } = await import("../../../services/bucket/archive.js");
const { restoreBucket } = await import("../../../services/bucket/restore.js");

const { assignBucketToFriend, unassignBucketFromFriend, listFriendBucketAssignments } =
  await import("../../../services/bucket-assignment.service.js");

const { tagContent, untagContent, listTagsByBucket } =
  await import("../../../services/bucket-content-tag.service.js");

const { getBucketExportManifest, getBucketExportPage } =
  await import("../../../services/bucket-export.service.js");

const { bucketRouter } = await import("../../../trpc/routers/bucket.js");

const createCaller = makeCallerFactory({ bucket: bucketRouter });

const BUCKET_ID = brandId<BucketId>("bkt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const CONNECTION_ID = brandId<FriendConnectionId>("fc_11111111-2222-3333-4444-555555555555");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JidWNrZXQ=";

const MOCK_BUCKET_RESULT = {
  id: BUCKET_ID,
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "base64data==" as EncryptedBase64,
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
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(createBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.bucket.create({ systemId: MOCK_SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
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
      const result = await caller.bucket.get({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID });

      expect(vi.mocked(getBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });

    it("rejects invalid bucketId format", async () => {
      const caller = createCaller();
      await expect(
        caller.bucket.get({
          systemId: MOCK_SYSTEM_ID,
          bucketId: brandId<BucketId>("not-a-bucket-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBucket).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.get({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("bucket.list", () => {
    it("calls listBuckets and returns result", async () => {
      vi.mocked(listBuckets).mockResolvedValue(MOCK_PAGINATED);
      const caller = createCaller();
      const result = await caller.bucket.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listBuckets)).toHaveBeenCalledOnce();
      expect(vi.mocked(listBuckets).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
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
          systemId: MOCK_SYSTEM_ID,
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
      const result = await caller.bucket.archive({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveBucket).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.archive({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("bucket.restore", () => {
    it("calls restoreBucket and returns result", async () => {
      vi.mocked(restoreBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
      const caller = createCaller();
      const result = await caller.bucket.restore({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID });

      expect(vi.mocked(restoreBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(MOCK_BUCKET_RESULT);
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("bucket.delete", () => {
    it("calls deleteBucket and returns success", async () => {
      vi.mocked(deleteBucket).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.bucket.delete({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when dependents exist", async () => {
      vi.mocked(deleteBucket).mockRejectedValue(
        new ApiHttpError(409, "HAS_DEPENDENTS", "Bucket has dependents"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.delete({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID }),
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
        caller.bucket.create({ systemId: MOCK_SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── assignFriend ──────────────────────────────────────────────────

  describe("bucket.assignFriend", () => {
    it("calls assignBucketToFriend with correct args", async () => {
      const mockResult = {
        friendConnectionId: CONNECTION_ID,
        bucketId: BUCKET_ID,
        friendAccountId: brandId<AccountId>("acct_friend001"),
      };
      vi.mocked(assignBucketToFriend).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.assignFriend({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        connectionId: CONNECTION_ID,
        encryptedBucketKey: "a2V5ZGF0YQ==",
        keyVersion: 1,
      });

      expect(vi.mocked(assignBucketToFriend)).toHaveBeenCalledOnce();
      expect(vi.mocked(assignBucketToFriend).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(assignBucketToFriend).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(assignBucketToFriend).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.assignFriend({
          systemId: MOCK_SYSTEM_ID,
          bucketId: BUCKET_ID,
          connectionId: CONNECTION_ID,
          encryptedBucketKey: "a2V5ZGF0YQ==",
          keyVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── unassignFriend ────────────────────────────────────────────────

  describe("bucket.unassignFriend", () => {
    it("calls unassignBucketFromFriend and returns result", async () => {
      const mockResult = { pendingRotation: { systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID } };
      vi.mocked(unassignBucketFromFriend).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.unassignFriend({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        connectionId: CONNECTION_ID,
      });

      expect(vi.mocked(unassignBucketFromFriend)).toHaveBeenCalledOnce();
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(unassignBucketFromFriend).mock.calls[0]?.[3]).toBe(CONNECTION_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(unassignBucketFromFriend).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.unassignFriend({
          systemId: MOCK_SYSTEM_ID,
          bucketId: BUCKET_ID,
          connectionId: CONNECTION_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── listFriendAssignments ─────────────────────────────────────────

  describe("bucket.listFriendAssignments", () => {
    it("calls listFriendBucketAssignments and returns result", async () => {
      const mockResult = [
        {
          friendConnectionId: CONNECTION_ID,
          bucketId: BUCKET_ID,
          friendAccountId: brandId<AccountId>("acct_friend001"),
        },
      ];
      vi.mocked(listFriendBucketAssignments).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.listFriendAssignments({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(listFriendBucketAssignments)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFriendBucketAssignments).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listFriendBucketAssignments).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── tagContent ────────────────────────────────────────────────────

  describe("bucket.tagContent", () => {
    it("calls tagContent with correct args", async () => {
      const mockResult = {
        entityType: "member" as const,
        entityId: brandId<MemberId>("mem_aa0e8400-e29b-41d4-a716-446655440001"),
        bucketId: BUCKET_ID,
      };
      vi.mocked(tagContent).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.tagContent({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        entityId: "mem_aa0e8400-e29b-41d4-a716-446655440001",
      });

      expect(vi.mocked(tagContent)).toHaveBeenCalledOnce();
      expect(vi.mocked(tagContent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(tagContent).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(tagContent).mockRejectedValue(new ApiHttpError(409, "CONFLICT", "Already tagged"));
      const caller = createCaller();
      await expect(
        caller.bucket.tagContent({
          systemId: MOCK_SYSTEM_ID,
          bucketId: BUCKET_ID,
          entityType: "member",
          entityId: "mem_aa0e8400-e29b-41d4-a716-446655440001",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── untagContent ──────────────────────────────────────────────────

  describe("bucket.untagContent", () => {
    it("calls untagContent with correct args and returns success", async () => {
      vi.mocked(untagContent).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.bucket.untagContent({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        entityId: "mem_aa0e8400-e29b-41d4-a716-446655440001",
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(untagContent)).toHaveBeenCalledOnce();
      expect(vi.mocked(untagContent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(untagContent).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(untagContent).mock.calls[0]?.[3]).toEqual({
        entityType: "member",
        entityId: "mem_aa0e8400-e29b-41d4-a716-446655440001",
      });
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(untagContent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Tag not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.untagContent({
          systemId: MOCK_SYSTEM_ID,
          bucketId: BUCKET_ID,
          entityType: "member",
          entityId: "mem_aa0e8400-e29b-41d4-a716-446655440001",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── listTags ──────────────────────────────────────────────────────

  describe("bucket.listTags", () => {
    it("calls listTagsByBucket and returns result", async () => {
      const mockResult = [
        {
          entityType: "member" as const,
          entityId: brandId<MemberId>("mem_aa0e8400-e29b-41d4-a716-446655440001"),
          bucketId: BUCKET_ID,
        },
      ];
      vi.mocked(listTagsByBucket).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.listTags({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(listTagsByBucket)).toHaveBeenCalledOnce();
      expect(vi.mocked(listTagsByBucket).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listTagsByBucket).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── exportManifest ────────────────────────────────────────────────

  describe("bucket.exportManifest", () => {
    it("calls getBucketExportManifest and returns result", async () => {
      const mockResult = {
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        entries: [],
        etag: "etag_abc",
      };
      vi.mocked(getBucketExportManifest).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.bucket.exportManifest({
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(getBucketExportManifest)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucketExportManifest).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getBucketExportManifest).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBucketExportManifest).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.exportManifest({ systemId: MOCK_SYSTEM_ID, bucketId: BUCKET_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
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
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        limit: 50,
      });

      expect(vi.mocked(getBucketExportPage)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[2]).toBe(BUCKET_ID);
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[4]).toBe("member");
      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[5]).toBe(50);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBucketExportPage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Bucket not found"),
      );
      const caller = createCaller();
      await expect(
        caller.bucket.exportPage({
          systemId: MOCK_SYSTEM_ID,
          bucketId: BUCKET_ID,
          entityType: "member",
          limit: 50,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
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
        systemId: MOCK_SYSTEM_ID,
        bucketId: BUCKET_ID,
        entityType: "member",
        limit: 50,
        cursor: "cur_xyz",
      });

      expect(vi.mocked(getBucketExportPage).mock.calls[0]?.[6]).toBe("cur_xyz");
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listBuckets).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.bucket.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createBucket).mockResolvedValue(MOCK_BUCKET_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.bucket.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      "write",
    );
  });
});
