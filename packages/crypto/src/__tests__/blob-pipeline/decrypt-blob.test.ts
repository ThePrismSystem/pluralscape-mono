import { brandId } from "@pluralscape/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { decryptBlob } from "../../blob-pipeline/decrypt-blob.js";
import { encryptBlob } from "../../blob-pipeline/encrypt-blob.js";
import { DecryptionFailedError, InvalidInputError } from "../../errors.js";
import { _resetForTesting, configureSodium, initSodium } from "../../sodium.js";

import type { SodiumAdapter } from "../../adapter/interface.js";
import type { BlobEncryptionMetadata } from "../../blob-pipeline/blob-encryption-metadata.js";
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

/** Helper to build T1 metadata for testing. */
function t1Metadata(overrides?: Partial<BlobEncryptionMetadata>): BlobEncryptionMetadata {
  return {
    tier: 1,
    algorithm: "xchacha20-poly1305",
    bucketId: null,
    streamed: false,
    ...overrides,
  };
}

describe("decryptBlob", () => {
  describe("non-streamed edge cases", () => {
    it("throws InvalidInputError for data shorter than nonce + tag", () => {
      // XChaCha20 nonce = 24 bytes, Poly1305 tag = 16 bytes => need at least 40
      const tooShort = new Uint8Array(30);
      expect(() =>
        decryptBlob({
          encryptedData: tooShort,
          metadata: t1Metadata(),
          tier: 1,
          masterKey,
        }),
      ).toThrow(InvalidInputError);
    });

    it("throws InvalidInputError for zero-length data", () => {
      expect(() =>
        decryptBlob({
          encryptedData: new Uint8Array(0),
          metadata: t1Metadata(),
          tier: 1,
          masterKey,
        }),
      ).toThrow(InvalidInputError);
    });

    it("throws DecryptionFailedError for tampered ciphertext", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = encryptBlob({ data, tier: 1, masterKey });

      // Flip a bit in the ciphertext portion (after nonce)
      const tampered = new Uint8Array(result.encryptedData);
      const NONCE_BYTES = 24;
      tampered[NONCE_BYTES] = (tampered[NONCE_BYTES] ?? 0) ^ 0xff;

      expect(() =>
        decryptBlob({
          encryptedData: tampered,
          metadata: result.metadata,
          tier: 1,
          masterKey,
        }),
      ).toThrow(DecryptionFailedError);
    });

    it("throws DecryptionFailedError for tampered nonce", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = encryptBlob({ data, tier: 1, masterKey });

      const tampered = new Uint8Array(result.encryptedData);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;

      expect(() =>
        decryptBlob({
          encryptedData: tampered,
          metadata: result.metadata,
          tier: 1,
          masterKey,
        }),
      ).toThrow(DecryptionFailedError);
    });
  });

  describe("stream deserialization", () => {
    it("throws InvalidInputError for payload shorter than 8-byte header", () => {
      const tooShort = new Uint8Array(4);
      expect(() =>
        decryptBlob({
          encryptedData: tooShort,
          metadata: t1Metadata({ streamed: true }),
          tier: 1,
          masterKey,
        }),
      ).toThrow(InvalidInputError);
    });

    it("throws InvalidInputError when chunkCount exceeds MAX_STREAM_CHUNKS", () => {
      // Build a header with chunkCount = 100_000 (> 65_536)
      const buf = new Uint8Array(8);
      const view = new DataView(buf.buffer);
      view.setUint32(0, 100_000, true); // chunkCount
      view.setUint32(4, 0, true); // totalLength

      expect(() =>
        decryptBlob({
          encryptedData: buf,
          metadata: t1Metadata({ streamed: true }),
          tier: 1,
          masterKey,
        }),
      ).toThrow(InvalidInputError);
    });

    it("throws InvalidInputError for truncated chunk data", () => {
      // Header says 1 chunk, but no chunk data follows
      const buf = new Uint8Array(8);
      const view = new DataView(buf.buffer);
      view.setUint32(0, 1, true); // chunkCount = 1
      view.setUint32(4, 10, true); // totalLength

      expect(() =>
        decryptBlob({
          encryptedData: buf,
          metadata: t1Metadata({ streamed: true }),
          tier: 1,
          masterKey,
        }),
      ).toThrow(InvalidInputError);
    });

    it("throws DecryptionFailedError for tampered stream ciphertext", () => {
      const data = new Uint8Array(70_000).fill(0xcd);
      const result = encryptBlob({ data, tier: 1, masterKey });

      expect(result.metadata.streamed).toBe(true);

      // Tamper with a byte well past the header
      const tampered = new Uint8Array(result.encryptedData);
      const TAMPER_OFFSET = 50;
      tampered[TAMPER_OFFSET] = (tampered[TAMPER_OFFSET] ?? 0) ^ 0xff;

      expect(() =>
        decryptBlob({
          encryptedData: tampered,
          metadata: result.metadata,
          tier: 1,
          masterKey,
        }),
      ).toThrow(DecryptionFailedError);
    });
  });

  describe("T2 decryption", () => {
    it("round-trips T2 blob with bucket key", () => {
      const data = new Uint8Array([10, 20, 30]);
      const result = encryptBlob({
        data,
        tier: 2,
        bucketKey,
        bucketId: brandId<BucketId>("bucket_dec"),
      });

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 2,
        bucketKey,
      });
      expect(decrypted).toEqual(data);
    });

    it("fails with wrong bucket key", () => {
      const data = new Uint8Array([40, 50, 60]);
      const result = encryptBlob({
        data,
        tier: 2,
        bucketKey,
        bucketId: brandId<BucketId>("bucket_wrong"),
      });

      const wrongKey = adapter.aeadKeygen();
      expect(() =>
        decryptBlob({
          encryptedData: result.encryptedData,
          metadata: result.metadata,
          tier: 2,
          bucketKey: wrongKey,
        }),
      ).toThrow(DecryptionFailedError);
    });

    it("round-trips T2 large (streamed) blob", () => {
      const data = new Uint8Array(70_000).fill(0xef);
      const result = encryptBlob({
        data,
        tier: 2,
        bucketKey,
        bucketId: brandId<BucketId>("bucket_stream"),
      });

      expect(result.metadata.streamed).toBe(true);

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 2,
        bucketKey,
      });
      expect(decrypted).toEqual(data);
    });
  });

  describe("zero-length blob", () => {
    it("round-trips zero-length data", () => {
      const data = new Uint8Array(0);
      const result = encryptBlob({ data, tier: 1, masterKey });

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 1,
        masterKey,
      });
      expect(decrypted).toEqual(data);
    });
  });
});
