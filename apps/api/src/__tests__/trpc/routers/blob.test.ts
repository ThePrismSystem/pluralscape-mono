import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { BlobId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/blob.service.js", () => ({
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  getBlob: vi.fn(),
  listBlobs: vi.fn(),
  getDownloadUrl: vi.fn(),
  archiveBlob: vi.fn(),
}));

vi.mock("../../../lib/storage.js", () => ({
  getStorageAdapter: vi.fn(() => ({})),
  getQuotaService: vi.fn(() => ({})),
}));

const { createUploadUrl, confirmUpload, getBlob, listBlobs, getDownloadUrl, archiveBlob } =
  await import("../../../services/blob.service.js");

const { blobRouter } = await import("../../../trpc/routers/blob.js");

const createCaller = makeCallerFactory({ blob: blobRouter });

const BLOB_ID = "blob_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as BlobId;

const MOCK_BLOB_RESULT = {
  id: BLOB_ID,
  systemId: SYSTEM_ID,
  purpose: "member-photo" as const,
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  checksum: null,
  uploadedAt: 1_700_000_000_000 as UnixMillis,
  thumbnailOfBlobId: null,
};

const MOCK_UPLOAD_URL_RESULT = {
  blobId: BLOB_ID,
  uploadUrl: "https://s3.example.com/upload?signed=token",
  expiresAt: 1_700_003_600_000 as UnixMillis,
};

const MOCK_DOWNLOAD_URL_RESULT = {
  blobId: BLOB_ID,
  downloadUrl: "https://s3.example.com/download?signed=token",
  expiresAt: 1_700_003_600_000 as UnixMillis,
};

const VALID_UPLOAD_INPUT = {
  systemId: SYSTEM_ID,
  purpose: "member-photo" as const,
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  encryptionTier: 1 as const,
};

describe("blob router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createUploadUrl ───────────────────────────────────────────────

  describe("blob.createUploadUrl", () => {
    it("calls createUploadUrl with storageAdapter and quotaService and returns result", async () => {
      vi.mocked(createUploadUrl).mockResolvedValue(MOCK_UPLOAD_URL_RESULT);
      const caller = createCaller();
      const result = await caller.blob.createUploadUrl(VALID_UPLOAD_INPUT);

      expect(vi.mocked(createUploadUrl)).toHaveBeenCalledOnce();
      expect(vi.mocked(createUploadUrl).mock.calls[0]?.[3]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_UPLOAD_URL_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.blob.createUploadUrl(VALID_UPLOAD_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.blob.createUploadUrl({ ...VALID_UPLOAD_INPUT, systemId: foreignSystemId }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(413) as PAYLOAD_TOO_LARGE", async () => {
      vi.mocked(createUploadUrl).mockRejectedValue(
        new ApiHttpError(413, "BLOB_TOO_LARGE", "File too large"),
      );
      const caller = createCaller();
      await expect(caller.blob.createUploadUrl(VALID_UPLOAD_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }),
      );
    });
  });

  // ── confirmUpload ────────────────────────────────────────────────

  describe("blob.confirmUpload", () => {
    const VALID_CONFIRM_INPUT = {
      systemId: SYSTEM_ID,
      blobId: BLOB_ID,
      checksum: "a".repeat(64),
    };

    it("calls confirmUpload with correct systemId and blobId", async () => {
      vi.mocked(confirmUpload).mockResolvedValue(MOCK_BLOB_RESULT);
      const caller = createCaller();
      const result = await caller.blob.confirmUpload(VALID_CONFIRM_INPUT);

      expect(vi.mocked(confirmUpload)).toHaveBeenCalledOnce();
      expect(vi.mocked(confirmUpload).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(confirmUpload).mock.calls[0]?.[2]).toBe(BLOB_ID);
      expect(result).toEqual(MOCK_BLOB_RESULT);
    });

    it("rejects invalid blobId format", async () => {
      const caller = createCaller();
      await expect(
        caller.blob.confirmUpload({
          ...VALID_CONFIRM_INPUT,
          blobId: "invalid-id" as BlobId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(confirmUpload).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
      );
      const caller = createCaller();
      await expect(caller.blob.confirmUpload(VALID_CONFIRM_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("blob.get", () => {
    it("calls getBlob with correct systemId and blobId", async () => {
      vi.mocked(getBlob).mockResolvedValue(MOCK_BLOB_RESULT);
      const caller = createCaller();
      const result = await caller.blob.get({ systemId: SYSTEM_ID, blobId: BLOB_ID });

      expect(vi.mocked(getBlob)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBlob).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getBlob).mock.calls[0]?.[2]).toBe(BLOB_ID);
      expect(result).toEqual(MOCK_BLOB_RESULT);
    });

    it("rejects invalid blobId format", async () => {
      const caller = createCaller();
      await expect(
        caller.blob.get({ systemId: SYSTEM_ID, blobId: "invalid-id" as BlobId }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBlob).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Blob not found"));
      const caller = createCaller();
      await expect(caller.blob.get({ systemId: SYSTEM_ID, blobId: BLOB_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("blob.list", () => {
    it("calls listBlobs and returns result", async () => {
      const mockResult = {
        data: [MOCK_BLOB_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listBlobs).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.blob.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listBlobs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listBlobs).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listBlobs).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.blob.list({
        systemId: SYSTEM_ID,
        cursor: "blob_cursor",
        limit: 20,
        includeArchived: true,
      });

      const opts = vi.mocked(listBlobs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("blob_cursor");
      expect(opts?.limit).toBe(20);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── getDownloadUrl ────────────────────────────────────────────────

  describe("blob.getDownloadUrl", () => {
    it("calls getDownloadUrl with storageAdapter and returns result", async () => {
      vi.mocked(getDownloadUrl).mockResolvedValue(MOCK_DOWNLOAD_URL_RESULT);
      const caller = createCaller();
      const result = await caller.blob.getDownloadUrl({ systemId: SYSTEM_ID, blobId: BLOB_ID });

      expect(vi.mocked(getDownloadUrl)).toHaveBeenCalledOnce();
      expect(vi.mocked(getDownloadUrl).mock.calls[0]?.[2]).toBe(SYSTEM_ID);
      expect(vi.mocked(getDownloadUrl).mock.calls[0]?.[3]).toBe(BLOB_ID);
      expect(result).toEqual(MOCK_DOWNLOAD_URL_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getDownloadUrl).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
      );
      const caller = createCaller();
      await expect(
        caller.blob.getDownloadUrl({ systemId: SYSTEM_ID, blobId: BLOB_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("blob.delete", () => {
    it("calls archiveBlob and returns success", async () => {
      vi.mocked(archiveBlob).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.blob.delete({ systemId: SYSTEM_ID, blobId: BLOB_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveBlob)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveBlob).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveBlob).mock.calls[0]?.[2]).toBe(BLOB_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveBlob).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
      );
      const caller = createCaller();
      await expect(caller.blob.delete({ systemId: SYSTEM_ID, blobId: BLOB_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });
});
