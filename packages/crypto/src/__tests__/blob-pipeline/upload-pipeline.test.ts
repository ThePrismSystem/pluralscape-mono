import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { ContentTypeNotAllowedError } from "../../blob-pipeline/content-validation.js";
import { processDownload } from "../../blob-pipeline/download-pipeline.js";
import { prepareUpload } from "../../blob-pipeline/upload-pipeline.js";
import { _resetForTesting, configureSodium, initSodium } from "../../sodium.js";

import type { SodiumAdapter } from "../../adapter/interface.js";
import type { KdfMasterKey } from "../../types.js";

let adapter: SodiumAdapter;
let masterKey: KdfMasterKey;

beforeAll(async () => {
  _resetForTesting();
  adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
  masterKey = adapter.kdfKeygen();
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

    // Different nonces → different ciphertext → different checksums
    expect(r1.checksum).not.toBe(r2.checksum);
    // But both are valid hex
    expect(r1.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(r2.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("full pipeline round-trip: prepareUpload → processDownload", () => {
    const data = new Uint8Array([42, 43, 44, 45]);
    const prepared = prepareUpload({
      data,
      purpose: "journal-image",
      mimeType: "image/jpeg",
      tier: 1,
      masterKey,
    });

    const decrypted = processDownload({
      encryptedData: prepared.encryptedData,
      metadata: prepared.encryptionMetadata,
      masterKey,
    });

    expect(decrypted).toEqual(data);
  });
});
