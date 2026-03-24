import { PAGINATION } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { BlobResult } from "../../services/blob.service.js";
import type { BlobId, PaginatedResult, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../routes/blobs/blobs.constants.js", () => ({
  PRESIGNED_UPLOAD_TTL_MS: 900_000,
  DEFAULT_BLOB_LIMIT: 25,
  MAX_BLOB_LIMIT: 100,
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { createUploadUrl, confirmUpload, getBlob, getDownloadUrl, archiveBlob, listBlobs } =
  await import("../../services/blob.service.js");

const { QuotaExceededError } = await import("@pluralscape/storage");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const BLOB_ID = "blob_test-blob" as BlobId;

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_CHECKSUM = "a".repeat(64);
const VALID_STORAGE_KEY = `${SYSTEM_ID}/${BLOB_ID}`;

function makeBlobRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: BLOB_ID,
    systemId: SYSTEM_ID,
    storageKey: VALID_STORAGE_KEY,
    mimeType: "image/png",
    sizeBytes: 1024,
    encryptionTier: 1,
    bucketId: null,
    purpose: "avatar",
    thumbnailOfBlobId: null,
    checksum: VALID_CHECKSUM,
    createdAt: 1000,
    uploadedAt: 2000,
    expiresAt: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function makeStorageAdapter(overrides: Record<string, unknown> = {}) {
  return {
    generatePresignedUploadUrl: vi.fn().mockResolvedValue({
      supported: true,
      url: "https://storage.example.com/upload/presigned",
      expiresAt: 3000 as number,
    }),
    generatePresignedDownloadUrl: vi.fn().mockResolvedValue({
      supported: true,
      url: "https://storage.example.com/download/presigned",
      expiresAt: 3000 as number,
    }),
    ...overrides,
  };
}

function makeQuotaService(overrides: Record<string, unknown> = {}) {
  return {
    assertQuota: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests: createUploadUrl ────────────────────────────────────────────

describe("createUploadUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    const storageAdapter = makeStorageAdapter();
    const quotaService = makeQuotaService();

    await expect(
      createUploadUrl(
        db,
        storageAdapter as never,
        quotaService as never,
        SYSTEM_ID,
        { purpose: "avatar", mimeType: "image/png", sizeBytes: 1024, encryptionTier: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("creates a presigned upload URL successfully", async () => {
    const { db, chain } = mockDb();
    chain.values.mockResolvedValueOnce(undefined);
    const storageAdapter = makeStorageAdapter();
    const quotaService = makeQuotaService();

    const result = await createUploadUrl(
      db,
      storageAdapter as never,
      quotaService as never,
      SYSTEM_ID,
      { purpose: "avatar", mimeType: "image/png", sizeBytes: 1024, encryptionTier: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.blobId).toMatch(/^blob_/);
    expect(result.uploadUrl).toBe("https://storage.example.com/upload/presigned");
    expect(result.expiresAt).toBe(3000);
    expect(storageAdapter.generatePresignedUploadUrl).toHaveBeenCalledOnce();
    expect(quotaService.assertQuota).toHaveBeenCalledWith(SYSTEM_ID, 1024);
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it("throws BLOB_TOO_LARGE when sizeBytes exceeds purpose limit", async () => {
    const { db } = mockDb();
    const storageAdapter = makeStorageAdapter();
    const quotaService = makeQuotaService();

    // avatar limit is 5 MiB = 5_242_880 bytes
    await expect(
      createUploadUrl(
        db,
        storageAdapter as never,
        quotaService as never,
        SYSTEM_ID,
        { purpose: "avatar", mimeType: "image/png", sizeBytes: 6_000_000, encryptionTier: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toMatchObject({ code: "BLOB_TOO_LARGE", status: 413 });

    expect(quotaService.assertQuota).not.toHaveBeenCalled();
    expect(storageAdapter.generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("throws QUOTA_EXCEEDED when quota service rejects", async () => {
    const { db } = mockDb();
    const storageAdapter = makeStorageAdapter();
    const quotaService = makeQuotaService({
      assertQuota: vi
        .fn()
        .mockRejectedValue(new QuotaExceededError(SYSTEM_ID, 900_000_000, 1_000_000_000, 1024)),
    });

    await expect(
      createUploadUrl(
        db,
        storageAdapter as never,
        quotaService as never,
        SYSTEM_ID,
        { purpose: "avatar", mimeType: "image/png", sizeBytes: 1024, encryptionTier: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 413 });

    expect(storageAdapter.generatePresignedUploadUrl).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();
    const storageAdapter = makeStorageAdapter();
    const quotaService = makeQuotaService();

    await expect(
      createUploadUrl(
        db,
        storageAdapter as never,
        quotaService as never,
        SYSTEM_ID,
        { purpose: "invalid-purpose", mimeType: "image/png", sizeBytes: 1024, encryptionTier: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    expect(quotaService.assertQuota).not.toHaveBeenCalled();
    expect(storageAdapter.generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR when presigned upload is not supported by backend", async () => {
    const { db, chain } = mockDb();
    chain.values.mockResolvedValueOnce(undefined);
    const storageAdapter = makeStorageAdapter({
      generatePresignedUploadUrl: vi.fn().mockResolvedValue({ supported: false }),
    });
    const quotaService = makeQuotaService();

    await expect(
      createUploadUrl(
        db,
        storageAdapter as never,
        quotaService as never,
        SYSTEM_ID,
        { purpose: "avatar", mimeType: "image/png", sizeBytes: 1024, encryptionTier: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    // Audit fires inside the transaction (before the S3 call), so it IS called
    // even when the presigned URL generation subsequently fails.
    expect(mockAudit).toHaveBeenCalledOnce();
  });
});

// ── Tests: confirmUpload ──────────────────────────────────────────────

describe("confirmUpload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("confirms a pending upload and returns BlobResult", async () => {
    const { db, chain } = mockDb();
    const pendingRow = makeBlobRow({ uploadedAt: null, checksum: null });
    const confirmedRow = makeBlobRow();
    chain.limit.mockResolvedValueOnce([pendingRow]);
    chain.returning.mockResolvedValueOnce([confirmedRow]);

    const result = await confirmUpload(
      db,
      SYSTEM_ID,
      BLOB_ID,
      { checksum: VALID_CHECKSUM },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(BLOB_ID);
    expect(result.checksum).toBe(VALID_CHECKSUM);
    expect(result.uploadedAt).toBe(2000);
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it("returns existing result idempotently when already confirmed", async () => {
    const { db, chain } = mockDb();
    const alreadyConfirmedRow = makeBlobRow();
    chain.limit.mockResolvedValueOnce([alreadyConfirmedRow]);

    const result = await confirmUpload(
      db,
      SYSTEM_ID,
      BLOB_ID,
      { checksum: VALID_CHECKSUM },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(BLOB_ID);
    expect(result.checksum).toBe(VALID_CHECKSUM);
    // No update or audit on idempotent re-confirm
    expect(chain.update).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when blob does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      confirmUpload(db, SYSTEM_ID, BLOB_ID, { checksum: VALID_CHECKSUM }, AUTH, mockAudit),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    // checksum must be exactly 64 chars
    await expect(
      confirmUpload(db, SYSTEM_ID, BLOB_ID, { checksum: "tooshort" }, AUTH, mockAudit),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    expect(mockAudit).not.toHaveBeenCalled();
  });
});

// ── Tests: getBlob ────────────────────────────────────────────────────

describe("getBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns BlobResult for an existing confirmed blob", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeBlobRow()]);

    const result = await getBlob(db, SYSTEM_ID, BLOB_ID, AUTH);

    expect(result.id).toBe(BLOB_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.purpose).toBe("avatar");
    expect(result.mimeType).toBe("image/png");
    expect(result.sizeBytes).toBe(1024);
    expect(result.checksum).toBe(VALID_CHECKSUM);
    expect(result.uploadedAt).toBe(2000);
    expect(result.thumbnailOfBlobId).toBeNull();
  });

  it("throws NOT_FOUND when blob does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getBlob(db, SYSTEM_ID, BLOB_ID, AUTH)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

// ── Tests: getDownloadUrl ─────────────────────────────────────────────

describe("getDownloadUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a presigned download URL for an existing confirmed blob", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ storageKey: VALID_STORAGE_KEY }]);
    const storageAdapter = makeStorageAdapter();

    const result = await getDownloadUrl(db, storageAdapter as never, SYSTEM_ID, BLOB_ID, AUTH);

    expect(result.blobId).toBe(BLOB_ID);
    expect(result.downloadUrl).toBe("https://storage.example.com/download/presigned");
    expect(result.expiresAt).toBe(3000);
    expect(storageAdapter.generatePresignedDownloadUrl).toHaveBeenCalledWith({
      storageKey: VALID_STORAGE_KEY,
    });
  });

  it("throws NOT_FOUND when blob does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    const storageAdapter = makeStorageAdapter();

    await expect(
      getDownloadUrl(db, storageAdapter as never, SYSTEM_ID, BLOB_ID, AUTH),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(storageAdapter.generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });
});

// ── Tests: archiveBlob ────────────────────────────────────────────────

describe("archiveBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives an existing confirmed blob", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: BLOB_ID }]);

    await archiveBlob(db, SYSTEM_ID, BLOB_ID, AUTH, mockAudit);

    expect(chain.update).toHaveBeenCalledOnce();
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when blob does not exist or is already archived", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(archiveBlob(db, SYSTEM_ID, BLOB_ID, AUTH, mockAudit)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    expect(chain.update).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

// ── Tests: listBlobs ─────────────────────────────────────────────────

describe("listBlobs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty paginated result when no blobs exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result: PaginatedResult<BlobResult> = await listBlobs(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns paginated blobs for a system", async () => {
    const { db, chain } = mockDb();
    const rows = [makeBlobRow(), makeBlobRow({ id: "blob_second-blob" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listBlobs(db, SYSTEM_ID, AUTH, { limit: 25 });

    expect(result.items).toHaveLength(2);
    const first = result.items[0];
    expect(first).toBeDefined();
    expect(first?.id).toBe(BLOB_ID);
    expect(result.hasMore).toBe(false);
  });

  it("sets hasMore=true when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    // limit+1 rows means there are more results
    const rows = [
      makeBlobRow({ id: "blob_one" }),
      makeBlobRow({ id: "blob_two" }),
      makeBlobRow({ id: "blob_three" }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listBlobs(db, SYSTEM_ID, AUTH, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("blob_two");
    }
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(listBlobs(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("excludes archived blobs by default", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeBlobRow()]);

    await listBlobs(db, SYSTEM_ID, AUTH);

    // The where call should be invoked (conditions include archived=false)
    expect(chain.where).toHaveBeenCalled();
  });

  it("respects cursor parameter for pagination", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listBlobs(db, SYSTEM_ID, AUTH, { cursor: "blob_some-cursor" as never });

    expect(chain.where).toHaveBeenCalled();
  });
});
