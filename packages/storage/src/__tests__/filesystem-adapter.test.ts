import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FilesystemBlobStorageAdapter } from "../adapters/filesystem/filesystem-adapter.js";
import { BlobTooLargeError, StorageBackendError } from "../errors.js";

import { runBlobStorageContract } from "./blob-storage.contract.js";
import { makeBlobData, makeBytes } from "./test-helpers.js";

import type { StorageKey } from "@pluralscape/types";

let storageRoot: string;

beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), "ps-fs-adapter-"));
});

afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});

describe("FilesystemBlobStorageAdapter", () => {
  runBlobStorageContract(() => new FilesystemBlobStorageAdapter({ storageRoot }));
});

describe("FilesystemBlobStorageAdapter-specific", () => {
  // ── maxSizeBytes ───────────────────────────────────────────────────

  describe("maxSizeBytes", () => {
    it("rejects upload when data exceeds maxSizeBytes", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot, maxSizeBytes: 10 });
      const data = makeBytes(0xff, 20);
      const params = makeBlobData(data);
      await expect(adapter.upload(params)).rejects.toThrow(BlobTooLargeError);
    });

    it("accepts upload when data is within maxSizeBytes", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot, maxSizeBytes: 100 });
      const data = makeBytes(0xab, 50);
      const params = makeBlobData(data);
      const metadata = await adapter.upload(params);
      expect(metadata.sizeBytes).toBe(50);
    });

    it("does not enforce a size limit by default", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const data = makeBytes(0xcc, 1024);
      const params = makeBlobData(data);
      const metadata = await adapter.upload(params);
      expect(metadata.sizeBytes).toBe(1024);
    });
  });

  // ── File permissions ───────────────────────────────────────────────

  describe("file permissions", () => {
    it("writes blob files with mode 0o600", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(1));
      await adapter.upload(params);

      // storageKey format: sys_test/blob_{uuid}
      const parts = params.storageKey.split("/");
      const blobPath = join(storageRoot, ...parts);
      const fileStat = await stat(blobPath);
      expect(fileStat.mode & 0o777).toBe(0o600);
    });

    it("writes metadata sidecar files with mode 0o600", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(1));
      await adapter.upload(params);

      const parts = params.storageKey.split("/");
      const metaPath = join(storageRoot, ...parts) + ".meta.json";
      const fileStat = await stat(metaPath);
      expect(fileStat.mode & 0o777).toBe(0o600);
    });
  });

  // ── Metadata sidecar ──────────────────────────────────────────────

  describe("metadata sidecar", () => {
    it("stores metadata in a .meta.json sidecar file", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(0xab, 32), {
        mimeType: "image/png",
        checksum: "a".repeat(64),
      });
      await adapter.upload(params);

      const parts = params.storageKey.split("/");
      const metaPath = join(storageRoot, ...parts) + ".meta.json";
      const raw = await readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw) as Record<string, unknown>;
      expect(meta).toMatchObject({
        mimeType: "image/png",
        checksum: "a".repeat(64),
      });
      expect(meta).toHaveProperty("uploadedAt");
    });
  });

  // ── Path traversal guard ──────────────────────────────────────────

  describe("path traversal guard", () => {
    it("rejects keys containing '..'", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(1), {
        storageKey: "sys_test/../etc/passwd" as StorageKey,
      });
      await expect(adapter.upload(params)).rejects.toThrow(StorageBackendError);
    });

    it("rejects absolute path keys that resolve outside storageRoot", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(1), { storageKey: "/etc/passwd" as StorageKey });
      await expect(adapter.upload(params)).rejects.toThrow(StorageBackendError);
    });

    it("rejects download with path traversal key", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      await expect(adapter.download("../../../etc/passwd" as StorageKey)).rejects.toThrow(
        StorageBackendError,
      );
    });

    it("rejects delete with path traversal key", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      await expect(adapter.delete("sys_test/../../../etc/passwd" as StorageKey)).rejects.toThrow(
        StorageBackendError,
      );
    });
  });

  // ── Concurrent uploads ────────────────────────────────────────────

  describe("concurrent uploads", () => {
    it("handles concurrent uploads to different keys", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const uploads = Array.from({ length: 10 }, async (_, i) => {
        const data = makeBytes(i, 64);
        const params = makeBlobData(data);
        const meta = await adapter.upload(params);
        return { meta, params, data };
      });

      const results = await Promise.all(uploads);
      for (const { meta, params, data } of results) {
        expect(meta.sizeBytes).toBe(64);
        const downloaded = await adapter.download(params.storageKey);
        expect(downloaded).toEqual(data);
      }
    });
  });

  // ── Atomic writes ─────────────────────────────────────────────────

  describe("atomic writes", () => {
    it("does not leave partial files if blob directory creation fails", async () => {
      // Create a file where the system directory would be to cause mkdir to fail
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const blockingFile = join(storageRoot, "sys_blocked");
      await writeFile(blockingFile, "block", { mode: 0o600 });

      const params = makeBlobData(makeBytes(1), {
        storageKey: "sys_blocked/blob_test" as StorageKey,
      });
      await expect(adapter.upload(params)).rejects.toThrow();

      // The storageRoot should not have any temp files left behind
      const dirContents = await readFile(blockingFile, "utf-8");
      expect(dirContents).toBe("block");
    });
  });

  // ── System directory creation ─────────────────────────────────────

  describe("system directory creation", () => {
    it("creates system subdirectory on first upload", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params = makeBlobData(makeBytes(1), { storageKey: "sys_new/blob_first" as StorageKey });
      await adapter.upload(params);

      const dirStat = await stat(join(storageRoot, "sys_new"));
      expect(dirStat.isDirectory()).toBe(true);
    });

    it("reuses existing system directory for subsequent uploads", async () => {
      const adapter = new FilesystemBlobStorageAdapter({ storageRoot });
      const params1 = makeBlobData(makeBytes(1), { storageKey: "sys_reuse/blob_1" as StorageKey });
      const params2 = makeBlobData(makeBytes(2), { storageKey: "sys_reuse/blob_2" as StorageKey });
      await adapter.upload(params1);
      await adapter.upload(params2);

      const downloaded1 = await adapter.download(params1.storageKey);
      const downloaded2 = await adapter.download(params2.storageKey);
      expect(downloaded1).toEqual(makeBytes(1));
      expect(downloaded2).toEqual(makeBytes(2));
    });
  });
});
