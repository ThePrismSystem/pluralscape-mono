import { describe, expect, it, vi } from "vitest";

import { MemoryBlobStorageAdapter } from "../adapters/memory-adapter.js";
import { BlobCleanupHandler } from "../quota/cleanup-job.js";
import { OrphanBlobDetector } from "../quota/orphan-detector.js";

import { makeBlobData, makeBytes } from "./test-helpers.js";

import type { BlobArchiver } from "../quota/cleanup-job.js";
import type { OrphanBlobQuery } from "../quota/orphan-detector.js";

function mockArchiver(): { archiver: BlobArchiver; archiveFn: ReturnType<typeof vi.fn> } {
  const archiveFn = vi.fn().mockResolvedValue(undefined);
  return { archiver: { archiveByStorageKey: archiveFn }, archiveFn };
}

function mockOrphanQuery(keys: readonly string[]): OrphanBlobQuery {
  return { findOrphanedKeys: vi.fn().mockResolvedValue(keys) };
}

describe("BlobCleanupHandler", () => {
  it("deletes orphaned blobs from storage and archives metadata", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const key1 = "sys_a/blob_orphan_1";
    const key2 = "sys_a/blob_orphan_2";

    await adapter.upload(makeBlobData(makeBytes(1), { storageKey: key1 }));
    await adapter.upload(makeBlobData(makeBytes(2), { storageKey: key2 }));

    const { archiver, archiveFn } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([key1, key2]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const result = await handler.cleanup("sys_a");

    expect(result.deletedCount).toBe(2);
    expect(result.storageKeys).toEqual([key1, key2]);

    expect(await adapter.exists(key1)).toBe(false);
    expect(await adapter.exists(key2)).toBe(false);

    expect(archiveFn).toHaveBeenCalledWith(key1);
    expect(archiveFn).toHaveBeenCalledWith(key2);
  });

  it("returns zero count when no orphans found", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const { archiver, archiveFn } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const result = await handler.cleanup("sys_clean");

    expect(result.deletedCount).toBe(0);
    expect(result.storageKeys).toEqual([]);
    expect(archiveFn).not.toHaveBeenCalled();
  });

  it("is idempotent — cleaning already-deleted blobs succeeds", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const key = "sys_a/blob_already_gone";
    const { archiver, archiveFn } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([key]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const result = await handler.cleanup("sys_a");

    expect(result.deletedCount).toBe(1);
    expect(archiveFn).toHaveBeenCalledWith(key);
  });

  it("does not delete non-orphaned blobs", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const orphanKey = "sys_a/blob_orphan";
    const keptKey = "sys_a/blob_kept";

    await adapter.upload(makeBlobData(makeBytes(1), { storageKey: orphanKey }));
    await adapter.upload(makeBlobData(makeBytes(2), { storageKey: keptKey }));

    const { archiver } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([orphanKey]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    await handler.cleanup("sys_a");

    expect(await adapter.exists(orphanKey)).toBe(false);
    expect(await adapter.exists(keptKey)).toBe(true);
  });
});
