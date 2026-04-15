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
        // POST-based presigned uploads put the signature in fields, not the URL
        expect(result.fields).toBeDefined();
        expect(result.fields?.["X-Amz-Signature"]).toBeDefined();
        expect(result.expiresAt).toBeGreaterThan(Date.now());
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
      await expect(adapter.upload(params)).resolves.toBeDefined();
    });
  });
});
