import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { describe, expect, it } from "vitest";

import {
  encryptedBlobFromDriver,
  encryptedBlobToDriver,
  jsonFromDriver,
  jsonToDriver,
  timestampFromDriver,
  timestampToDriver,
} from "../columns/sqlite.js";

import type { EncryptedBlob } from "@pluralscape/types";
import type { BucketId } from "@pluralscape/types";

describe("sqliteTimestamp mapping", () => {
  it("passes through integer values", () => {
    const ms = 1704067200000;
    expect(timestampToDriver(ms)).toBe(ms);
    expect(timestampFromDriver(ms)).toBe(ms);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const ms = Date.now();
    expect(timestampFromDriver(timestampToDriver(ms))).toBe(ms);
  });

  it("throws on NaN in toDriver", () => {
    expect(() => timestampToDriver(NaN)).toThrow("not a finite number");
  });

  it("throws on Infinity in toDriver", () => {
    expect(() => timestampToDriver(Infinity)).toThrow("not a finite number");
  });

  it("throws on -Infinity in toDriver", () => {
    expect(() => timestampToDriver(-Infinity)).toThrow("not a finite number");
  });

  it("throws on NaN in fromDriver", () => {
    expect(() => timestampFromDriver(NaN)).toThrow("not a finite number");
  });

  it("throws on Infinity in fromDriver", () => {
    expect(() => timestampFromDriver(Infinity)).toThrow("not a finite number");
  });
});

describe("sqliteEncryptedBlob mapping", () => {
  function makeBlob(ciphertext = new Uint8Array([1, 2, 3])): EncryptedBlob {
    const nonce = new Uint8Array(AEAD_NONCE_BYTES);
    nonce.fill(0xbb);
    return {
      ciphertext,
      nonce,
      tier: 1,
      algorithm: "xchacha20-poly1305",
      keyVersion: null,
      bucketId: null,
    };
  }

  it("converts EncryptedBlob to Uint8Array", () => {
    const blob = makeBlob();
    const result = encryptedBlobToDriver(blob);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const blob = makeBlob(new Uint8Array([10, 20, 30]));
    const result = encryptedBlobFromDriver(encryptedBlobToDriver(blob));
    expect(result.ciphertext).toEqual(blob.ciphertext);
    expect(result.nonce).toEqual(blob.nonce);
    expect(result.tier).toBe(blob.tier);
    expect(result.algorithm).toBe(blob.algorithm);
    expect(result.keyVersion).toBe(blob.keyVersion);
    expect(result.bucketId).toBe(blob.bucketId);
  });

  it("round-trips T2 blob with keyVersion and bucketId", () => {
    const blob: EncryptedBlob = {
      ciphertext: new Uint8Array([40, 50, 60]),
      nonce: makeBlob().nonce,
      tier: 2,
      algorithm: "xchacha20-poly1305",
      keyVersion: 7,
      bucketId: "bucket-xyz" as BucketId,
    };
    const result = encryptedBlobFromDriver(encryptedBlobToDriver(blob));
    expect(result.ciphertext).toEqual(blob.ciphertext);
    expect(result.tier).toBe(2);
    expect(result.keyVersion).toBe(7);
    expect(result.bucketId).toBe("bucket-xyz");
  });
});

describe("sqliteJson mapping", () => {
  it("converts object to JSON string", () => {
    const input = { name: "test" };
    expect(jsonToDriver(input)).toBe('{"name":"test"}');
  });

  it("parses JSON string to object", () => {
    expect(jsonFromDriver('{"name":"test"}')).toEqual({ name: "test" });
  });

  it("round-trips nested objects", () => {
    const input = { nested: { array: [1, 2, 3] } };
    expect(jsonFromDriver(jsonToDriver(input))).toEqual(input);
  });

  it("throws with context on malformed JSON", () => {
    expect(() => jsonFromDriver("{invalid")).toThrow(
      'Failed to parse JSON from database: "{invalid"',
    );
  });

  it("throws on empty string", () => {
    expect(() => jsonFromDriver("")).toThrow("Failed to parse JSON from database");
  });
});
