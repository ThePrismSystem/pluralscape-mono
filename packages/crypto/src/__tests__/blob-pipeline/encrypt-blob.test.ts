import { brandId } from "@pluralscape/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { decryptBlob } from "../../blob-pipeline/decrypt-blob.js";
import { encryptBlob, encryptBlobStream } from "../../blob-pipeline/encrypt-blob.js";
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

    it("round-trips large data with streaming", { timeout: 15_000 }, () => {
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
        bucketId: brandId<BucketId>("bucket_test"),
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

  describe("streaming input (encryptBlobStream)", () => {
    const STREAM_THRESHOLD = 65_536;
    const TIER1_CHUNK = STREAM_THRESHOLD + 1024;

    it("T1: round-trips data from an async iterable source larger than the stream threshold", async () => {
      const total = TIER1_CHUNK + 12_345;
      const plaintext = adapter.randomBytes(total);

      const parts: readonly Uint8Array[] = [
        plaintext.subarray(0, 4096),
        plaintext.subarray(4096, TIER1_CHUNK),
        plaintext.subarray(TIER1_CHUNK),
      ];
      let idx = 0;
      const source: AsyncIterable<Uint8Array> = {
        [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          return {
            next(): Promise<IteratorResult<Uint8Array>> {
              const value = parts[idx];
              if (idx >= parts.length || value === undefined) {
                return Promise.resolve({ done: true, value: undefined });
              }
              idx += 1;
              return Promise.resolve({ done: false, value });
            },
          };
        },
      };

      const result = await encryptBlobStream({ data: source, tier: 1, masterKey });
      expect(result.metadata.streamed).toBe(true);

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 1,
        masterKey,
      });
      expect(decrypted).toEqual(plaintext);
    });

    it("T2: round-trips data from a ReadableByteStream-shaped source", async () => {
      const total = STREAM_THRESHOLD + 99;
      const plaintext = adapter.randomBytes(total);

      const parts: readonly Uint8Array[] = [
        plaintext.subarray(0, 100),
        plaintext.subarray(100, STREAM_THRESHOLD),
        plaintext.subarray(STREAM_THRESHOLD),
      ];
      let cursor = 0;
      const stream = {
        getReader(): {
          read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
          releaseLock(): void;
          cancel(): Promise<void>;
        } {
          return {
            read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }> {
              const value = parts[cursor];
              if (cursor >= parts.length || value === undefined) {
                return Promise.resolve({ done: true, value: undefined });
              }
              cursor += 1;
              return Promise.resolve({ done: false, value });
            },
            releaseLock(): void {
              /* noop */
            },
            cancel(): Promise<void> {
              return Promise.resolve();
            },
          };
        },
      };

      const result = await encryptBlobStream({
        data: stream,
        tier: 2,
        bucketKey,
        bucketId: brandId<BucketId>("bucket_stream"),
      });
      expect(result.metadata.streamed).toBe(true);
      expect(result.metadata.bucketId).toBe("bucket_stream");

      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 2,
        bucketKey,
      });
      expect(decrypted).toEqual(plaintext);
    });

    it("delegates to encryptBlob when given a Uint8Array below the stream threshold", async () => {
      const plaintext = new Uint8Array([7, 7, 7, 7]);
      const result = await encryptBlobStream({ data: plaintext, tier: 1, masterKey });

      expect(result.metadata.streamed).toBe(false); // sub-threshold path preserved
      const decrypted = decryptBlob({
        encryptedData: result.encryptedData,
        metadata: result.metadata,
        tier: 1,
        masterKey,
      });
      expect(decrypted).toEqual(plaintext);
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
        bucketId: brandId<BucketId>("bucket_x"),
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
