import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { describe, expect, it } from "vitest";

import {
  binaryFromDriver,
  binaryToDriver,
  encryptedBlobFromDriver,
  encryptedBlobToDriver,
  jsonFromDriver,
  jsonToDriver,
  timestampFromDriver,
  timestampToDriver,
} from "../columns/pg.js";

import type { EncryptedBlob } from "@pluralscape/types";

describe("pgTimestamp mapping", () => {
  it("converts UnixMillis to ISO string", () => {
    const ms = 1704067200000; // 2024-01-01T00:00:00.000Z
    expect(timestampToDriver(ms)).toBe("2024-01-01T00:00:00.000Z");
  });

  it("converts ISO string back to UnixMillis", () => {
    expect(timestampFromDriver("2024-01-01T00:00:00.000Z")).toBe(1704067200000);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const ms = Date.now();
    expect(timestampFromDriver(timestampToDriver(ms))).toBe(ms);
  });

  it("accepts negative timestamps (dates before epoch)", () => {
    const ms = -1000;
    expect(timestampFromDriver(timestampToDriver(ms))).toBe(ms);
  });

  it("throws on NaN", () => {
    expect(() => timestampToDriver(NaN)).toThrow("not a finite number");
  });

  it("throws on Infinity", () => {
    expect(() => timestampToDriver(Infinity)).toThrow("not a finite number");
  });

  it("throws on -Infinity", () => {
    expect(() => timestampToDriver(-Infinity)).toThrow("not a finite number");
  });

  it("throws on unparseable date string", () => {
    expect(() => timestampFromDriver("not-a-date")).toThrow("could not be parsed");
  });
});

describe("pgBinary mapping", () => {
  it("converts Uint8Array to Buffer", () => {
    const input = new Uint8Array([1, 2, 3]);
    const result = binaryToDriver(input);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it("converts Buffer back to Uint8Array", () => {
    const input = Buffer.from([1, 2, 3]);
    const result = binaryFromDriver(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const original = new Uint8Array([0, 127, 255]);
    const result = binaryFromDriver(binaryToDriver(original));
    expect([...result]).toEqual([...original]);
  });
});

describe("pgEncryptedBlob mapping", () => {
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

  it("converts EncryptedBlob to Buffer", () => {
    const blob = makeBlob();
    const result = encryptedBlobToDriver(blob);
    expect(Buffer.isBuffer(result)).toBe(true);
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
});

describe("pgJsonb mapping", () => {
  it("converts object to JSON string", () => {
    const input = { name: "test", count: 42 };
    expect(jsonToDriver(input)).toBe('{"name":"test","count":42}');
  });

  it("parses JSON string to object", () => {
    const result = jsonFromDriver('{"name":"test","count":42}');
    expect(result).toEqual({ name: "test", count: 42 });
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
