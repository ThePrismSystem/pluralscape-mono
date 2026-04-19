import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { S3BlobStorageAdapter } from "../adapters/s3/s3-adapter.js";
import { BlobTooLargeError } from "../errors.js";

import { runBlobStorageContract } from "./blob-storage.contract.js";
import { ensureMinio } from "./minio-container.js";
import { makeBlobData, makeBytes } from "./test-helpers.js";

import type { MinioTestContext } from "./minio-container.js";
import type { StorageKey } from "@pluralscape/types";

let ctx: MinioTestContext;

beforeAll(async () => {
  ctx = await ensureMinio();
}, 30_000);

afterAll(async () => {
  await ctx.cleanup();
});

describe("S3BlobStorageAdapter (MinIO integration)", () => {
  describe("contract tests", () => {
    runBlobStorageContract(() => {
      if (!ctx.available) {
        throw new Error("MinIO is not available — skipping S3 integration tests");
      }
      return new S3BlobStorageAdapter(ctx.config);
    });
  });

  describe("presigned URLs", () => {
    it("generates a presigned upload URL with expiry", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter(ctx.config);
      const result = await adapter.generatePresignedUploadUrl({
        storageKey: "sys_test/blob_presign_up" as StorageKey,
        mimeType: "image/png",
        sizeBytes: 1024,
      });
      expect(result.supported).toBe(true);
      if (result.supported) {
        // PUT-based presigned upload: signature is in the URL itself.
        expect(result.url).toContain("X-Amz-Signature");
        expect(result.expiresAt).toBeGreaterThan(Date.now());
        // No multipart fields for PUT uploads.
        expect(result.fields).toBeUndefined();
      }
    });

    it("generates a presigned download URL with expiry", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter(ctx.config);

      // Upload first so the key exists
      const data = makeBytes(0xab, 32);
      const params = makeBlobData(data, { storageKey: "sys_test/blob_presign_dl" as StorageKey });
      await adapter.upload(params);

      const result = await adapter.generatePresignedDownloadUrl({
        storageKey: params.storageKey,
      });
      expect(result.supported).toBe(true);
      if (result.supported) {
        expect(result.url).toContain("X-Amz-Signature");
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    // STORAGE-TC-L1: presigned URL must inherit the write-once precondition
    // so a second PUT to the same key is rejected server-side, and the
    // original bytes remain intact.
    it("rejects a second upload to the same key via a fresh presigned URL", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter(ctx.config);
      const storageKey = `sys_test/blob_write_once_${Date.now().toString()}` as StorageKey;
      const mimeType = "application/octet-stream";

      // First upload — signed URL, PUT, should succeed
      const firstUrl = await adapter.generatePresignedUploadUrl({
        storageKey,
        mimeType,
        sizeBytes: 5,
      });
      if (!firstUrl.supported) throw new Error("presigned uploads must be supported");

      const firstBody = new Uint8Array([1, 2, 3, 4, 5]);
      const firstResponse = await fetch(firstUrl.url, {
        method: "PUT",
        body: firstBody,
        headers: { "Content-Type": mimeType, "If-None-Match": "*" },
      });
      expect(firstResponse.ok).toBe(true);

      // Second upload against the same key — different content — must fail.
      // We regenerate a fresh presigned URL to simulate a replay / accidental
      // re-issue, and verify S3 rejects the request with a 4xx.
      const secondUrl = await adapter.generatePresignedUploadUrl({
        storageKey,
        mimeType,
        sizeBytes: 5,
      });
      if (!secondUrl.supported) throw new Error("presigned uploads must be supported");

      const secondBody = new Uint8Array([9, 9, 9, 9, 9]);
      const secondResponse = await fetch(secondUrl.url, {
        method: "PUT",
        body: secondBody,
        headers: { "Content-Type": mimeType, "If-None-Match": "*" },
      });
      expect(secondResponse.ok).toBe(false);
      expect(secondResponse.status).toBeGreaterThanOrEqual(400);
      expect(secondResponse.status).toBeLessThan(500);

      // Blob must still hold the FIRST upload's bytes.
      const downloaded = await adapter.download(storageKey);
      expect(downloaded).toEqual(firstBody);
    });

    it("respects custom expiry durations", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter({
        ...ctx.config,
        presignedUploadExpiryMs: 5 * 60 * 1_000, // 5 minutes
      });
      const result = await adapter.generatePresignedUploadUrl({
        storageKey: "sys_test/blob_custom_exp" as StorageKey,
        mimeType: null,
        sizeBytes: 512,
      });
      expect(result.supported).toBe(true);
      if (result.supported) {
        // Expiry should be roughly 5 minutes from now (within 10s tolerance)
        const expectedExpiry = Date.now() + 5 * 60 * 1_000;
        expect(result.expiresAt).toBeLessThan(expectedExpiry + 10_000);
        expect(result.expiresAt).toBeGreaterThan(expectedExpiry - 10_000);
      }
    });
  });

  describe("mimeType handling", () => {
    it("stores and retrieves null mimeType", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter(ctx.config);
      const data = makeBytes(0xcc, 16);
      const params = makeBlobData(data, {
        storageKey: "sys_test/blob_null_mime" as StorageKey,
        mimeType: null,
      });
      await adapter.upload(params);

      const meta = await adapter.getMetadata(params.storageKey);
      expect(meta).not.toBeNull();
      // S3 stores null mimeType as "application/octet-stream", adapter normalizes back to null
      expect(meta?.mimeType).toBeNull();
    });
  });

  describe("maxSizeBytes enforcement", () => {
    it("throws BlobTooLargeError when upload exceeds limit", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter({ ...ctx.config, maxSizeBytes: 10 });
      const data = makeBytes(0xff, 20);
      const params = makeBlobData(data);
      await expect(adapter.upload(params)).rejects.toThrow(BlobTooLargeError);
    });

    it("allows uploads within the limit", async (context) => {
      if (!ctx.available) {
        context.skip();
        return;
      }
      const adapter = new S3BlobStorageAdapter({ ...ctx.config, maxSizeBytes: 100 });
      const data = makeBytes(0xee, 50);
      const params = makeBlobData(data);
      await adapter.upload(params);
    });
  });
});
