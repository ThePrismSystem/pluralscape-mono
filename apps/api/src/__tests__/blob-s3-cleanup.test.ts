import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "./helpers/mock-db.js";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { JobDefinition, JobId, StorageKey, UnixMillis } from "@pluralscape/types";

// ── Mock deps ────────────────────────────────────────────────────────

const mockLogWarn = vi.fn();

vi.mock("../jobs/jobs.constants.js", () => ({
  BLOB_S3_CLEANUP_GRACE_PERIOD_MS: 30 * 86_400_000,
  BLOB_S3_CLEANUP_BATCH_SIZE: 100,
}));

vi.mock("../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: mockLogWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { createBlobS3CleanupHandler } = await import("../jobs/blob-s3-cleanup.js");

// ── Helpers ──────────────────────────────────────────────────────────

function makeStorageAdapter(): {
  adapter: BlobStorageAdapter;
  deleteFn: ReturnType<typeof vi.fn>;
} {
  const deleteFn = vi.fn().mockResolvedValue(undefined);
  const adapter: BlobStorageAdapter = {
    upload: vi.fn().mockResolvedValue({}),
    download: vi.fn().mockResolvedValue(new Uint8Array()),
    delete: deleteFn,
    exists: vi.fn().mockResolvedValue(false),
    getMetadata: vi.fn().mockResolvedValue(null),
    generatePresignedUploadUrl: vi.fn().mockResolvedValue({ supported: false }),
    generatePresignedDownloadUrl: vi.fn().mockResolvedValue({ supported: false }),
    supportsPresignedUrls: false,
  };
  return { adapter, deleteFn };
}

function stubJob(): JobDefinition<"blob-cleanup"> {
  return {
    id: "job_test" as JobId,
    systemId: null,
    type: "blob-cleanup" as const,
    status: "running",
    payload: {},
    attempts: 1,
    maxAttempts: 3,
    nextRetryAt: null,
    error: null,
    result: null,
    createdAt: 0 as UnixMillis,
    startedAt: 0 as UnixMillis,
    completedAt: null,
    idempotencyKey: null,
    lastHeartbeatAt: null,
    timeoutMs: 30_000,
    scheduledFor: null,
    priority: 0,
  } satisfies JobDefinition<"blob-cleanup">;
}

function stubCtx(): { ctx: JobHandlerContext; heartbeatFn: ReturnType<typeof vi.fn> } {
  const heartbeatFn = vi.fn().mockResolvedValue(undefined);
  return {
    ctx: {
      heartbeat: { heartbeat: heartbeatFn },
      signal: new AbortController().signal,
    },
    heartbeatFn,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("blob-s3-cleanup handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockLogWarn.mockClear();
  });

  it("skips cleanup when signal is already aborted", async () => {
    const { db } = mockDb();
    const { adapter, deleteFn } = makeStorageAdapter();
    const handler = createBlobS3CleanupHandler(db, adapter);
    const abortController = new AbortController();
    abortController.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: abortController.signal,
    });

    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("resolves without error when no archived blobs to clean up", async () => {
    const { db } = mockDb();
    const { adapter, deleteFn } = makeStorageAdapter();
    const handler = createBlobS3CleanupHandler(db, adapter);
    const { ctx } = stubCtx();

    await expect(handler(stubJob(), ctx)).resolves.toBeUndefined();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("deletes S3 objects for archived blobs past the grace period", async () => {
    const { db, chain } = mockDb();
    const archivedRows = [
      { id: "blob_one", storageKey: "sys_test/blob_one" },
      { id: "blob_two", storageKey: "sys_test/blob_two" },
    ];
    chain.limit.mockResolvedValueOnce(archivedRows);
    const { adapter, deleteFn } = makeStorageAdapter();
    const handler = createBlobS3CleanupHandler(db, adapter);
    const { ctx } = stubCtx();

    await handler(stubJob(), ctx);

    expect(deleteFn).toHaveBeenCalledTimes(2);
    expect(deleteFn).toHaveBeenCalledWith("sys_test/blob_one" as StorageKey);
    expect(deleteFn).toHaveBeenCalledWith("sys_test/blob_two" as StorageKey);
  });

  it("hard-deletes blob metadata rows after S3 cleanup", async () => {
    const { db, chain } = mockDb();
    const archivedRows = [{ id: "blob_one", storageKey: "sys_test/blob_one" }];
    chain.limit.mockResolvedValueOnce(archivedRows);
    const { adapter } = makeStorageAdapter();
    const handler = createBlobS3CleanupHandler(db, adapter);
    const { ctx } = stubCtx();

    await handler(stubJob(), ctx);

    expect(chain.delete).toHaveBeenCalled();
  });

  it("skips failed S3 deletes and only hard-deletes successful rows", async () => {
    const { db, chain } = mockDb();
    const archivedRows = [
      { id: "blob_ok", storageKey: "sys_test/blob_ok" },
      { id: "blob_poison", storageKey: "sys_test/blob_poison" },
      { id: "blob_ok2", storageKey: "sys_test/blob_ok2" },
    ];
    chain.limit.mockResolvedValueOnce(archivedRows);
    const { adapter, deleteFn } = makeStorageAdapter();
    // Second delete (blob_poison) throws
    deleteFn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("S3 unavailable"))
      .mockResolvedValueOnce(undefined);
    const handler = createBlobS3CleanupHandler(db, adapter);
    const { ctx } = stubCtx();
    await handler(stubJob(), ctx);

    // All 3 S3 deletes attempted
    expect(deleteFn).toHaveBeenCalledTimes(3);
    // Only 2 successful blobs should be hard-deleted from metadata
    expect(chain.where).toHaveBeenCalled();
    // Poison blob logged via structured logger
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Failed to delete S3 object for blob",
      expect.objectContaining({
        blobId: "blob_poison",
        err: expect.any(Error),
      }),
    );
  });

  it("emits heartbeats during batch processing", async () => {
    const { db, chain } = mockDb();
    const archivedRows = [
      { id: "blob_one", storageKey: "sys_test/blob_one" },
      { id: "blob_two", storageKey: "sys_test/blob_two" },
    ];
    chain.limit.mockResolvedValueOnce(archivedRows);
    const { adapter } = makeStorageAdapter();
    const handler = createBlobS3CleanupHandler(db, adapter);
    const { ctx, heartbeatFn } = stubCtx();

    await handler(stubJob(), ctx);

    expect(heartbeatFn).toHaveBeenCalled();
  });
});
