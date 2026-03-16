/**
 * Contract test suite for BlobStorageAdapter implementations.
 *
 * Usage:
 *   import { runBlobStorageContract } from "./blob-storage.contract.js";
 *   runBlobStorageContract(() => new YourBlobStorageAdapter());
 *
 * The factory function is called before each test to produce a fresh, empty adapter.
 */
import { describe, expect, it } from "vitest";

import { BlobAlreadyExistsError, BlobNotFoundError } from "../errors.js";

import { makeBytes, makeBlobData } from "./test-helpers.js";

import type { BlobStorageAdapter } from "../interface.js";
import type { StorageKey } from "@pluralscape/types";

export function runBlobStorageContract(factory: () => BlobStorageAdapter): void {
  describe("BlobStorageAdapter contract", () => {
    // ── 1. upload / download round-trip ────────────────────────────
    describe("upload / download round-trip", () => {
      it("stores and retrieves exact bytes", async () => {
        const adapter = factory();
        const original = makeBytes(0xab);
        const params = makeBlobData(original);
        await adapter.upload(params);
        const downloaded = await adapter.download(params.storageKey);
        expect(downloaded).toEqual(original);
      });

      it("preserves binary data faithfully", async () => {
        const adapter = factory();
        const original = new Uint8Array([0, 1, 127, 128, 255, 42]);
        const params = makeBlobData(original);
        await adapter.upload(params);
        const downloaded = await adapter.download(params.storageKey);
        expect(downloaded).toEqual(original);
      });
    });

    // ── 2. upload duplicate key → BlobAlreadyExistsError ───────────
    describe("upload duplicate key", () => {
      it("throws BlobAlreadyExistsError when key already exists", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(1));
        await adapter.upload(params);
        const duplicate = makeBlobData(makeBytes(2), { storageKey: params.storageKey });
        await expect(adapter.upload(duplicate)).rejects.toThrow(BlobAlreadyExistsError);
      });

      it("does not overwrite existing data on conflict", async () => {
        const adapter = factory();
        const original = makeBytes(0xaa);
        const params = makeBlobData(original);
        await adapter.upload(params);
        try {
          await adapter.upload(makeBlobData(makeBytes(0xbb), { storageKey: params.storageKey }));
        } catch {
          // Expected
        }
        const downloaded = await adapter.download(params.storageKey);
        expect(downloaded).toEqual(original);
      });
    });

    // ── 3. download non-existent → BlobNotFoundError ───────────────
    describe("download non-existent key", () => {
      it("throws BlobNotFoundError", async () => {
        const adapter = factory();
        await expect(adapter.download("sys_none/blob_ghost" as StorageKey)).rejects.toThrow(
          BlobNotFoundError,
        );
      });

      it("error carries the storage key", async () => {
        const adapter = factory();
        const key = "sys_test/blob_missing" as StorageKey;
        let caught: BlobNotFoundError | null = null;
        try {
          await adapter.download(key);
        } catch (err) {
          if (err instanceof BlobNotFoundError) caught = err;
        }
        expect(caught).not.toBeNull();
        expect(caught?.storageKey).toBe(key);
      });
    });

    // ── 4. delete ──────────────────────────────────────────────────
    describe("delete", () => {
      it("removes an existing blob", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(1));
        await adapter.upload(params);
        await adapter.delete(params.storageKey);
        expect(await adapter.exists(params.storageKey)).toBe(false);
      });

      it("is idempotent for non-existent keys", async () => {
        const adapter = factory();
        await expect(adapter.delete("sys_test/blob_ghost" as StorageKey)).resolves.not.toThrow();
      });

      it("throws BlobNotFoundError on download after delete", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(2));
        await adapter.upload(params);
        await adapter.delete(params.storageKey);
        await expect(adapter.download(params.storageKey)).rejects.toThrow(BlobNotFoundError);
      });
    });

    // ── 5. exists ──────────────────────────────────────────────────
    describe("exists", () => {
      it("returns false before upload", async () => {
        const adapter = factory();
        expect(await adapter.exists("sys_test/blob_missing" as StorageKey)).toBe(false);
      });

      it("returns true after upload", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(3));
        await adapter.upload(params);
        expect(await adapter.exists(params.storageKey)).toBe(true);
      });

      it("returns false after delete", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(4));
        await adapter.upload(params);
        await adapter.delete(params.storageKey);
        expect(await adapter.exists(params.storageKey)).toBe(false);
      });
    });

    // ── 6. getMetadata ─────────────────────────────────────────────
    describe("getMetadata", () => {
      it("returns null for non-existent key", async () => {
        const adapter = factory();
        expect(await adapter.getMetadata("sys_test/blob_none" as StorageKey)).toBeNull();
      });

      it("returns correct metadata after upload", async () => {
        const adapter = factory();
        const data = makeBytes(5, 32);
        const params = makeBlobData(data, { mimeType: "image/png", checksum: "a".repeat(64) });
        const uploaded = await adapter.upload(params);
        const meta = await adapter.getMetadata(params.storageKey);
        expect(meta).not.toBeNull();
        expect(meta?.storageKey).toBe(params.storageKey);
        expect(meta?.sizeBytes).toBe(32);
        expect(meta?.mimeType).toBe("image/png");
        expect(meta?.checksum).toBe("a".repeat(64));
        expect(meta?.uploadedAt).toBe(uploaded.uploadedAt);
      });

      it("returns null after blob is deleted", async () => {
        const adapter = factory();
        const params = makeBlobData(makeBytes(6));
        await adapter.upload(params);
        await adapter.delete(params.storageKey);
        expect(await adapter.getMetadata(params.storageKey)).toBeNull();
      });
    });

    // ── 7. presigned URLs ──────────────────────────────────────────
    describe("presigned URLs", () => {
      it("generatePresignedUploadUrl returns a result (supported or not)", async () => {
        const adapter = factory();
        const result = await adapter.generatePresignedUploadUrl({
          storageKey: "sys_test/blob_presign" as StorageKey,
          mimeType: null,
          sizeBytes: 1024,
        });
        expect(typeof result.supported).toBe("boolean");
        if (result.supported) {
          expect(typeof result.url).toBe("string");
          expect(typeof result.expiresAt).toBe("number");
        }
      });

      it("generatePresignedDownloadUrl returns a result (supported or not)", async () => {
        const adapter = factory();
        const result = await adapter.generatePresignedDownloadUrl({
          storageKey: "sys_test/blob_presign_dl" as StorageKey,
        });
        expect(typeof result.supported).toBe("boolean");
        if (result.supported) {
          expect(typeof result.url).toBe("string");
          expect(typeof result.expiresAt).toBe("number");
        }
      });

      it("supportsPresignedUrls matches generatePresignedUploadUrl result", async () => {
        const adapter = factory();
        const result = await adapter.generatePresignedUploadUrl({
          storageKey: "sys_test/blob_cap_check" as StorageKey,
          mimeType: null,
          sizeBytes: 1,
        });
        expect(result.supported).toBe(adapter.supportsPresignedUrls);
      });
    });

    // ── 8. Isolation ───────────────────────────────────────────────
    describe("key isolation", () => {
      it("operations on different keys are independent", async () => {
        const adapter = factory();
        const bytesA = makeBytes(0xa1, 8);
        const bytesB = makeBytes(0xb2, 8);
        const paramsA = makeBlobData(bytesA, { storageKey: "sys_a/blob_x" as StorageKey });
        const paramsB = makeBlobData(bytesB, { storageKey: "sys_b/blob_y" as StorageKey });
        await adapter.upload(paramsA);
        await adapter.upload(paramsB);

        await adapter.delete(paramsA.storageKey);

        expect(await adapter.exists(paramsA.storageKey)).toBe(false);
        expect(await adapter.exists(paramsB.storageKey)).toBe(true);
        const downloaded = await adapter.download(paramsB.storageKey);
        expect(downloaded).toEqual(bytesB);
      });
    });
  });
}
