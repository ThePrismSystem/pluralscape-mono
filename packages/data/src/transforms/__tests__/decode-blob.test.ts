import {
  configureSodium,
  encryptTier1,
  generateBucketKey,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decodeAndDecryptT1,
  decodeAndDecryptT2,
  encryptAndEncodeT1,
  encryptAndEncodeT2,
  extractT2BucketId,
} from "../decode-blob.js";

import { toBase64 } from "./helpers.js";

import type { AeadKey, KdfMasterKey } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";

let masterKey: KdfMasterKey;
let bucketKey: AeadKey;
const bucketId = "bkt_test" as BucketId;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
  bucketKey = generateBucketKey();
});

describe("decodeAndDecryptT1", () => {
  it("decodes base64 and decrypts a T1 blob to plaintext", () => {
    const plaintext = { name: "Alice", pronouns: ["they/them"] };
    const blob = encryptTier1(plaintext, masterKey);
    const base64 = toBase64(serializeEncryptedBlob(blob));

    const result = decodeAndDecryptT1(base64, masterKey);
    expect(result).toEqual(plaintext);
  });

  it("throws on invalid base64", () => {
    expect(() => decodeAndDecryptT1("not-valid-base64!!!", masterKey)).toThrow();
  });

  it("throws on corrupted blob", () => {
    const bytes = new Uint8Array(10).fill(0xff);
    const base64 = toBase64(bytes);
    expect(() => decodeAndDecryptT1(base64, masterKey)).toThrow();
  });
});

describe("encryptAndEncodeT1", () => {
  it("encrypts plaintext and encodes to base64 string", () => {
    const plaintext = { description: "test data" };
    const base64 = encryptAndEncodeT1(plaintext, masterKey);

    expect(typeof base64).toBe("string");
    const result = decodeAndDecryptT1(base64, masterKey);
    expect(result).toEqual(plaintext);
  });
});

describe("decodeAndDecryptT2", () => {
  it("decodes base64 and decrypts a T2 blob to plaintext", () => {
    const plaintext = { name: "Bob", role: "host" };
    const base64 = encryptAndEncodeT2(plaintext, bucketKey, bucketId);

    const result = decodeAndDecryptT2(base64, bucketKey);
    expect(result).toEqual(plaintext);
  });

  it("round-trips nested objects", () => {
    const plaintext = { nested: { a: 1, b: [2, 3] }, flag: true };
    const base64 = encryptAndEncodeT2(plaintext, bucketKey, bucketId);

    const result = decodeAndDecryptT2(base64, bucketKey);
    expect(result).toEqual(plaintext);
  });

  it("throws when blob tier is not 2", () => {
    const base64 = encryptAndEncodeT1({ x: 1 }, masterKey);
    expect(() => decodeAndDecryptT2(base64, bucketKey)).toThrow("Expected T2 blob, got tier 1");
  });
});

describe("encryptAndEncodeT2", () => {
  it("encrypts plaintext and encodes to base64 string", () => {
    const plaintext = { value: 42 };
    const base64 = encryptAndEncodeT2(plaintext, bucketKey, bucketId);

    expect(typeof base64).toBe("string");
    const result = decodeAndDecryptT2(base64, bucketKey);
    expect(result).toEqual(plaintext);
  });

  it("accepts an optional keyVersion", () => {
    const plaintext = { versioned: true };
    const base64 = encryptAndEncodeT2(plaintext, bucketKey, bucketId, 3);

    const result = decodeAndDecryptT2(base64, bucketKey);
    expect(result).toEqual(plaintext);
  });
});

describe("extractT2BucketId", () => {
  it("returns the bucket ID from a valid T2 blob", () => {
    const base64 = encryptAndEncodeT2({ hello: "world" }, bucketKey, bucketId);
    const result = extractT2BucketId(base64);
    expect(result).toBe(bucketId);
  });

  it("throws when given a T1 blob", () => {
    const base64 = encryptAndEncodeT1({ x: 1 }, masterKey);
    expect(() => extractT2BucketId(base64)).toThrow("Expected T2 blob, got tier 1");
  });

  it("throws on malformed base64", () => {
    expect(() => extractT2BucketId("not-valid-base64!!!")).toThrow();
  });
});
