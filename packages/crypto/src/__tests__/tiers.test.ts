import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { generateMasterKey } from "../master-key-wrap.js";
import { _resetForTesting, configureSodium, getSodium, initSodium } from "../sodium.js";
import {
  decryptTier1,
  decryptTier1Batch,
  decryptTier2,
  decryptTier2Batch,
  encryptTier1,
  encryptTier1Batch,
  encryptTier2,
  encryptTier2Batch,
  wrapTier3,
} from "../tiers.js";

import type { AeadKey, KdfMasterKey } from "../types.js";
import type { BucketId, T1EncryptedBlob, T2EncryptedBlob } from "@pluralscape/types";

let masterKey: KdfMasterKey;
let masterKey2: KdfMasterKey;

beforeAll(async () => {
  _resetForTesting();
  const adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();

  masterKey = generateMasterKey();
  masterKey2 = generateMasterKey();
});

afterAll(() => {
  _resetForTesting();
});

describe("encryptTier1/decryptTier1", () => {
  it("roundtrips a simple object", () => {
    const data = { name: "Alice", pronouns: "they/them" };
    const blob = encryptTier1(data, masterKey);
    const result = decryptTier1(blob, masterKey);
    expect(result).toEqual(data);
  });

  it("roundtrips complex nested object", () => {
    const data = {
      members: [{ name: "Alice" }, { name: "Bob" }],
      meta: { nested: { deep: true } },
      count: 0,
      active: false,
      tags: ["a", "b"],
      nullable: null,
    };
    const blob = encryptTier1(data, masterKey);
    const result = decryptTier1(blob, masterKey);
    expect(result).toEqual(data);
  });

  it("output has correct T1 metadata", () => {
    const blob = encryptTier1({ test: true }, masterKey);
    expect(blob.tier).toBe(1);
    expect(blob.keyVersion).toBeNull();
    expect(blob.bucketId).toBeNull();
    expect(blob.algorithm).toBe("xchacha20-poly1305");
  });

  it("two encryptions of same data produce different ciphertexts", () => {
    const data = { same: "data" };
    const blob1 = encryptTier1(data, masterKey);
    const blob2 = encryptTier1(data, masterKey);
    expect(blob1.ciphertext).not.toEqual(blob2.ciphertext);
  });

  it("wrong master key throws DecryptionFailedError", () => {
    const blob = encryptTier1({ secret: true }, masterKey);
    expect(() => decryptTier1(blob, masterKey2)).toThrow(DecryptionFailedError);
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const blob = encryptTier1({ data: "tamper test" }, masterKey);
    const tampered = new Uint8Array(blob.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const tamperedBlob: T1EncryptedBlob = { ...blob, ciphertext: tampered };
    expect(() => decryptTier1(tamperedBlob, masterKey)).toThrow(DecryptionFailedError);
  });

  it("roundtrips empty object", () => {
    const data = {};
    const blob = encryptTier1(data, masterKey);
    const result = decryptTier1(blob, masterKey);
    expect(result).toEqual(data);
  });

  it("tampered nonce throws DecryptionFailedError", () => {
    const blob = encryptTier1({ data: "nonce test" }, masterKey);
    const tampered = new Uint8Array(blob.nonce);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const tamperedBlob: T1EncryptedBlob = { ...blob, nonce: tampered };
    expect(() => decryptTier1(tamperedBlob, masterKey)).toThrow(DecryptionFailedError);
  });

  it("undefined input throws InvalidInputError", () => {
    expect(() => encryptTier1(undefined, masterKey)).toThrow(InvalidInputError);
  });

  it("derived key is cleaned up via memzero", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    encryptTier1({ data: true }, masterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("derived key cleanup happens even when decrypt throws", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const blob = encryptTier1({ data: true }, masterKey);

    memzeroSpy.mockClear();
    expect(() => decryptTier1(blob, masterKey2)).toThrow(DecryptionFailedError);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });
});

describe("encryptTier2/decryptTier2", () => {
  const bucketId = "test-bucket-123" as BucketId;
  let bucketKey: AeadKey;

  beforeAll(() => {
    bucketKey = getSodium().aeadKeygen();
  });

  it("roundtrip preserves data", () => {
    const data = { name: "Alice", pronouns: "they/them" };
    const blob = encryptTier2(data, { bucketKey, bucketId });
    const result = decryptTier2(blob, bucketKey);
    expect(result).toEqual(data);
  });

  it("output has correct T2 metadata", () => {
    const blob = encryptTier2({ test: true }, { bucketKey, bucketId, keyVersion: 3 });
    expect(blob.tier).toBe(2);
    expect(blob.bucketId).toBe(bucketId);
    expect(blob.keyVersion).toBe(3);
  });

  it("default keyVersion is null when omitted", () => {
    const blob = encryptTier2({ test: true }, { bucketKey, bucketId });
    expect(blob.keyVersion).toBeNull();
  });

  it("wrong bucket key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const blob = encryptTier2({ secret: true }, { bucketKey, bucketId });
    expect(() => decryptTier2(blob, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const blob = encryptTier2({ data: "tamper" }, { bucketKey, bucketId });
    const tampered = new Uint8Array(blob.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const tamperedBlob: T2EncryptedBlob = { ...blob, ciphertext: tampered };
    expect(() => decryptTier2(tamperedBlob, bucketKey)).toThrow(DecryptionFailedError);
  });

  it("tampered nonce throws DecryptionFailedError", () => {
    const blob = encryptTier2({ data: "nonce test" }, { bucketKey, bucketId });
    const tampered = new Uint8Array(blob.nonce);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const tamperedBlob: T2EncryptedBlob = { ...blob, nonce: tampered };
    expect(() => decryptTier2(tamperedBlob, bucketKey)).toThrow(DecryptionFailedError);
  });

  it("two encryptions produce different ciphertexts", () => {
    const data = { same: "data" };
    const blob1 = encryptTier2(data, { bucketKey, bucketId });
    const blob2 = encryptTier2(data, { bucketKey, bucketId });
    expect(blob1.ciphertext).not.toEqual(blob2.ciphertext);
  });

  it("roundtrips complex nested data", () => {
    const data = {
      members: [{ name: "Alice" }, { name: "Bob" }],
      meta: { nested: { deep: true } },
      count: 0,
      active: false,
      tags: ["a", "b"],
      nullable: null,
    };
    const blob = encryptTier2(data, { bucketKey, bucketId });
    const result = decryptTier2(blob, bucketKey);
    expect(result).toEqual(data);
  });

  it("algorithm field is xchacha20-poly1305", () => {
    const blob = encryptTier2({ test: true }, { bucketKey, bucketId });
    expect(blob.algorithm).toBe("xchacha20-poly1305");
  });

  it("keyVersion: 0 throws InvalidInputError", () => {
    expect(() => encryptTier2({ test: true }, { bucketKey, bucketId, keyVersion: 0 })).toThrow(
      InvalidInputError,
    );
  });

  it("negative keyVersion throws InvalidInputError", () => {
    expect(() => encryptTier2({ test: true }, { bucketKey, bucketId, keyVersion: -1 })).toThrow(
      InvalidInputError,
    );
  });

  it("fractional keyVersion throws InvalidInputError", () => {
    expect(() => encryptTier2({ test: true }, { bucketKey, bucketId, keyVersion: 1.5 })).toThrow(
      InvalidInputError,
    );
  });
});

describe("wrapTier3", () => {
  it("returns exact same reference", () => {
    const data = { name: "Alice" };
    const result = wrapTier3(data);
    expect(result).toBe(data);
  });

  it("works with arrays", () => {
    const data = [1, 2, 3];
    expect(wrapTier3(data)).toBe(data);
  });

  it("works with primitives", () => {
    expect(wrapTier3("hello")).toBe("hello");
    expect(wrapTier3(42)).toBe(42);
    expect(wrapTier3(true)).toBe(true);
  });

  it("works with null", () => {
    expect(wrapTier3(null)).toBeNull();
  });

  it("works with undefined", () => {
    const undef: unknown = undefined;
    expect(wrapTier3(undef)).toBeUndefined();
  });
});

describe("type safety", () => {
  it("encryptTier1 returns T1EncryptedBlob", () => {
    expectTypeOf(encryptTier1).returns.toEqualTypeOf<T1EncryptedBlob>();
  });

  it("encryptTier2 returns T2EncryptedBlob", () => {
    expectTypeOf(encryptTier2).returns.toEqualTypeOf<T2EncryptedBlob>();
  });

  it("decryptTier1 accepts only T1EncryptedBlob", () => {
    expectTypeOf(decryptTier1).parameter(0).toEqualTypeOf<T1EncryptedBlob>();
  });

  it("decryptTier2 accepts only T2EncryptedBlob", () => {
    expectTypeOf(decryptTier2).parameter(0).toEqualTypeOf<T2EncryptedBlob>();
  });

  it("decrypt functions return unknown for type safety", () => {
    expectTypeOf(decryptTier1).returns.toEqualTypeOf<unknown>();
    expectTypeOf(decryptTier2).returns.toEqualTypeOf<unknown>();
  });
});

describe("encryptTier1Batch/decryptTier1Batch", () => {
  it("roundtrips array of 3 objects", () => {
    const items = [
      { name: "Alice", pronouns: "they/them" },
      { name: "Bob", pronouns: "he/him" },
      { name: "Charlie", pronouns: "she/her" },
    ];
    const blobs = encryptTier1Batch(items, masterKey);
    expect(blobs).toHaveLength(3);
    const results = decryptTier1Batch(blobs, masterKey);
    expect(results).toEqual(items);
  });

  it("empty array returns empty array", () => {
    const blobs = encryptTier1Batch([], masterKey);
    expect(blobs).toEqual([]);
    const results = decryptTier1Batch([], masterKey);
    expect(results).toEqual([]);
  });

  it("memzero called exactly once (not N times)", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
    encryptTier1Batch(items, masterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("decryptTier1Batch memzero called exactly once", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const blobs = encryptTier1Batch(items, masterKey);
    memzeroSpy.mockClear();
    decryptTier1Batch(blobs, masterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("decryptTier1Batch memzero on error path", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const items = [{ a: 1 }, { b: 2 }];
    const blobs = encryptTier1Batch(items, masterKey);
    memzeroSpy.mockClear();
    expect(() => decryptTier1Batch(blobs, masterKey2)).toThrow(DecryptionFailedError);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("single-item batch roundtrip", () => {
    const items = [{ solo: true }];
    const blobs = encryptTier1Batch(items, masterKey);
    expect(blobs).toHaveLength(1);
    const results = decryptTier1Batch(blobs, masterKey);
    expect(results).toEqual(items);
  });

  it("partial corruption throws DecryptionFailedError", () => {
    const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const blobs = encryptTier1Batch(items, masterKey);
    // Tamper with the second blob
    const secondBlob = blobs[1];
    if (!secondBlob) throw new Error("Expected blob at index 1");
    const tampered = new Uint8Array(secondBlob.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    blobs[1] = { ...secondBlob, ciphertext: tampered } as T1EncryptedBlob;
    expect(() => decryptTier1Batch(blobs, masterKey)).toThrow(DecryptionFailedError);
  });
});

describe("encryptTier2Batch/decryptTier2Batch", () => {
  const bucketId = "batch-bucket" as BucketId;
  let bucketKey: AeadKey;

  beforeAll(() => {
    bucketKey = getSodium().aeadKeygen();
  });

  it("roundtrips array, all blobs have same bucketId/keyVersion", () => {
    const items = [{ x: 1 }, { y: 2 }, { z: 3 }];
    const blobs = encryptTier2Batch(items, { bucketKey, bucketId, keyVersion: 5 });
    expect(blobs).toHaveLength(3);
    for (const blob of blobs) {
      expect(blob.bucketId).toBe(bucketId);
      expect(blob.keyVersion).toBe(5);
    }
    const results = decryptTier2Batch(blobs, bucketKey);
    expect(results).toEqual(items);
  });

  it("empty array returns empty array", () => {
    const blobs = encryptTier2Batch([], { bucketKey, bucketId });
    expect(blobs).toEqual([]);
    const results = decryptTier2Batch([], bucketKey);
    expect(results).toEqual([]);
  });

  it("wrong key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const items = [{ x: 1 }, { y: 2 }];
    const blobs = encryptTier2Batch(items, { bucketKey, bucketId });
    expect(() => decryptTier2Batch(blobs, wrongKey)).toThrow(DecryptionFailedError);
  });
});
