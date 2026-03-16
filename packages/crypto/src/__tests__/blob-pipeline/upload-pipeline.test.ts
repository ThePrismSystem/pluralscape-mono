import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { ContentTypeNotAllowedError } from "../../blob-pipeline/content-validation.js";
import { decryptBlob } from "../../blob-pipeline/decrypt-blob.js";
import { prepareUpload } from "../../blob-pipeline/upload-pipeline.js";
import { _resetForTesting, configureSodium, initSodium } from "../../sodium.js";

import type { SodiumAdapter } from "../../adapter/interface.js";
import type { AeadKey, KdfMasterKey } from "../../types.js";
import type { BucketId } from "@pluralscape/types";

let adapter: SodiumAdapter;
let masterKey: KdfMasterKey;
let bucketKey: AeadKey;

beforeAll(async () => {
  _resetForTesting();
  adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
  masterKey = adapter.kdfKeygen();
  bucketKey = adapter.aeadKeygen();
});

afterAll(() => {
  _resetForTesting();
});

describe("prepareUpload", () => {
  it("validates, encrypts, and checksums in one call", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const result = prepareUpload({
      data,
      purpose: "avatar",
      mimeType: "image/png",
      tier: 1,
      masterKey,
    });

    expect(result.encryptedData.byteLength).toBeGreaterThan(0);
    expect(result.checksum).toHaveLength(64);
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.encryptionMetadata.tier).toBe(1);
    expect(result.encryptedSizeBytes).toBe(result.encryptedData.byteLength);
  });

  it("rejects disallowed content types", () => {
    const data = new Uint8Array([1]);
    expect(() =>
      prepareUpload({
        data,
        purpose: "avatar",
        mimeType: "application/pdf",
        tier: 1,
        masterKey,
      }),
    ).toThrow(ContentTypeNotAllowedError);
  });

  it("accepts MIME types case-insensitively", () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(() =>
      prepareUpload({
        data,
        purpose: "avatar",
        mimeType: "Image/PNG",
        tier: 1,
        masterKey,
      }),
    ).not.toThrow();
  });

  it("produces deterministic checksums for same encrypted output", () => {
    // Different encryptions produce different ciphertext, so checksums differ
    const data = new Uint8Array([10, 20, 30]);
    const r1 = prepareUpload({
      data,
      purpose: "attachment",
      mimeType: "image/png",
      tier: 1,
      masterKey,
    });
    const r2 = prepareUpload({
      data,
      purpose: "attachment",
      mimeType: "image/png",
      tier: 1,
      masterKey,
    });

    // Different nonces -> different ciphertext -> different checksums
    expect(r1.checksum).not.toBe(r2.checksum);
    // But both are valid hex
    expect(r1.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(r2.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("full pipeline round-trip: prepareUpload -> decryptBlob", () => {
    const data = new Uint8Array([42, 43, 44, 45]);
    const prepared = prepareUpload({
      data,
      purpose: "journal-image",
      mimeType: "image/jpeg",
      tier: 1,
      masterKey,
    });

    const decrypted = decryptBlob({
      encryptedData: prepared.encryptedData,
      metadata: prepared.encryptionMetadata,
      tier: 1,
      masterKey,
    });

    expect(decrypted).toEqual(data);
  });

  it("T2 pipeline round-trip through prepareUpload", () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const prepared = prepareUpload({
      data,
      purpose: "avatar",
      mimeType: "image/webp",
      tier: 2,
      bucketKey,
      bucketId: "bucket_upload_test" as BucketId,
    });

    expect(prepared.encryptionMetadata.tier).toBe(2);
    expect(prepared.encryptionMetadata.bucketId).toBe("bucket_upload_test");

    const decrypted = decryptBlob({
      encryptedData: prepared.encryptedData,
      metadata: prepared.encryptionMetadata,
      tier: 2,
      bucketKey,
    });

    expect(decrypted).toEqual(data);
  });
});
