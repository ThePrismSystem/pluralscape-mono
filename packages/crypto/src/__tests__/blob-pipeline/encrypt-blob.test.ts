import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { decryptBlob } from "../../blob-pipeline/decrypt-blob.js";
import { encryptBlob } from "../../blob-pipeline/encrypt-blob.js";
import { DecryptionFailedError } from "../../errors.js";
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

describe("encryptBlob / decryptBlob", () => {
  describe("T1 (master key)", () => {
    it("round-trips small data", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = encryptBlob({ data, tier: 1, masterKey });

      expect(result.metadata.tier).toBe(1);
      expect(result.metadata.algorithm).toBe("xchacha20-poly1305");
      expect(result.metadata.bucketId).toBeNull();
      expect(result.metadata.streamed).toBe(false);

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 1,
        masterKey,
      });
      expect(decrypted).toEqual(data);
    });

    it("round-trips large data with streaming", () => {
      // > 64 KiB to trigger streaming
      const data = new Uint8Array(70_000).fill(0xab);
      const result = encryptBlob({ data, tier: 1, masterKey });

      expect(result.metadata.streamed).toBe(true);

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 1,
        masterKey,
      });
      expect(decrypted).toEqual(data);
    });

    it("produces different ciphertext for same data", () => {
      const data = new Uint8Array([10, 20, 30]);
      const r1 = encryptBlob({ data, tier: 1, masterKey });
      const r2 = encryptBlob({ data, tier: 1, masterKey });

      // Different nonces -> different ciphertext
      expect(r1.encryptedData).not.toEqual(r2.encryptedData);
    });
  });

  describe("T2 (bucket key)", () => {
    it("round-trips with bucket key", () => {
      const data = new Uint8Array([5, 4, 3, 2, 1]);
      const result = encryptBlob({
        data,
        tier: 2,
        bucketKey,
        bucketId: "bucket_test" as BucketId,
      });

      expect(result.metadata.tier).toBe(2);
      expect(result.metadata.bucketId).toBe("bucket_test");
      expect(result.metadata.streamed).toBe(false);

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 2,
        bucketKey,
      });
      expect(decrypted).toEqual(data);
    });
  });

  describe("wrong key failure", () => {
    it("fails to decrypt T1 with wrong master key", () => {
      const data = new Uint8Array([1, 2, 3]);
      const result = encryptBlob({ data, tier: 1, masterKey });

      const wrongKey = adapter.kdfKeygen();
      expect(() =>
        decryptBlob({
          encryptedData: result.encryptedData,
          metadata: result.metadata,
          tier: 1,
          masterKey: wrongKey,
        }),
      ).toThrow(DecryptionFailedError);
    });

    it("fails to decrypt T2 with wrong bucket key", () => {
      const data = new Uint8Array([4, 5, 6]);
      const result = encryptBlob({
        data,
        tier: 2,
        bucketKey,
        bucketId: "bucket_x" as BucketId,
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
  });
});
