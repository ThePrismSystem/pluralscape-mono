import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { MemoryBlobStorageAdapter } from "../adapters/memory-adapter.js";
import { BlobCleanupHandler } from "../quota/cleanup-job.js";
import { OrphanBlobDetector } from "../quota/orphan-detector.js";

import { makeBlobData, makeBytes } from "./test-helpers.js";

import type { BlobArchiver } from "../quota/cleanup-job.js";
import type { OrphanBlobQuery } from "../quota/orphan-detector.js";
import type { StorageKey, SystemId } from "@pluralscape/types";

function mockArchiver(): { archiver: BlobArchiver; archiveFn: ReturnType<typeof vi.fn> } {
  const archiveFn = vi.fn().mockResolvedValue(undefined);
  return { archiver: { archiveByStorageKey: archiveFn }, archiveFn };
}

function mockOrphanQuery(keys: readonly StorageKey[]): OrphanBlobQuery {
  return { findOrphanedKeys: vi.fn().mockResolvedValue(keys) };
}

describe("BlobCleanupHandler", () => {
  it("deletes orphaned blobs from storage and archives metadata", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const key1 = "sys_a/blob_orphan_1" as StorageKey;
    const key2 = "sys_a/blob_orphan_2" as StorageKey;

    await adapter.upload(makeBlobData(makeBytes(1), { storageKey: key1 }));
    await adapter.upload(makeBlobData(makeBytes(2), { storageKey: key2 }));

    const { archiver, archiveFn } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([key1, key2]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const result = await handler.cleanup(brandId<SystemId>("sys_a"));

    expect(result.deletedCount).toBe(2);
    expect(result.storageKeys).toEqual([key1, key2]);
    expect(result.failedCount).toBe(0);
    expect(result.failedKeys).toEqual([]);

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

    const result = await handler.cleanup(brandId<SystemId>("sys_clean"));

    expect(result.deletedCount).toBe(0);
    expect(result.storageKeys).toEqual([]);
    expect(result.failedCount).toBe(0);
    expect(result.failedKeys).toEqual([]);
    expect(archiveFn).not.toHaveBeenCalled();
  });

  it("is idempotent — cleaning already-deleted blobs succeeds on repeated calls", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const key = "sys_a/blob_already_gone" as StorageKey;
    const { archiver } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([key]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const first = await handler.cleanup(brandId<SystemId>("sys_a"));
    const second = await handler.cleanup(brandId<SystemId>("sys_a"));

    expect(first.deletedCount).toBe(1);
    expect(first.failedCount).toBe(0);
    expect(second.deletedCount).toBe(1);
    expect(second.failedCount).toBe(0);
  });

  it("does not delete non-orphaned blobs", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const orphanKey = "sys_a/blob_orphan" as StorageKey;
    const keptKey = "sys_a/blob_kept" as StorageKey;

    await adapter.upload(makeBlobData(makeBytes(1), { storageKey: orphanKey }));
    await adapter.upload(makeBlobData(makeBytes(2), { storageKey: keptKey }));

    const { archiver } = mockArchiver();
    const detector = new OrphanBlobDetector(mockOrphanQuery([orphanKey]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    await handler.cleanup(brandId<SystemId>("sys_a"));

    expect(await adapter.exists(orphanKey)).toBe(false);
    expect(await adapter.exists(keptKey)).toBe(true);
  });

  it("isolates per-key archiver failures and produces partial result", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const key1 = "sys_a/blob_ok" as StorageKey;
    const key2 = "sys_a/blob_fail" as StorageKey;
    const key3 = "sys_a/blob_ok2" as StorageKey;

    await adapter.upload(makeBlobData(makeBytes(1), { storageKey: key1 }));
    await adapter.upload(makeBlobData(makeBytes(2), { storageKey: key2 }));
    await adapter.upload(makeBlobData(makeBytes(3), { storageKey: key3 }));

    const archiveFn = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce(undefined);
    const archiver: BlobArchiver = { archiveByStorageKey: archiveFn };
    const detector = new OrphanBlobDetector(mockOrphanQuery([key1, key2, key3]));
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    const result = await handler.cleanup(brandId<SystemId>("sys_a"));

    expect(result.deletedCount).toBe(2);
    expect(result.storageKeys).toEqual([key1, key3]);
    expect(result.failedCount).toBe(1);
    expect(result.failedKeys).toEqual([key2]);
  });

  it("propagates detector failure immediately", async () => {
    const adapter = new MemoryBlobStorageAdapter();
    const { archiver } = mockArchiver();
    const failingQuery: OrphanBlobQuery = {
      findOrphanedKeys: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    };
    const detector = new OrphanBlobDetector(failingQuery);
    const handler = new BlobCleanupHandler(adapter, detector, archiver);

    await expect(handler.cleanup(brandId<SystemId>("sys_a"))).rejects.toThrow("DB unavailable");
  });
});
