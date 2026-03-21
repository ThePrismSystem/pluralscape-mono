import {
  AEAD_NONCE_BYTES,
  InvalidInputError,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
} from "@pluralscape/crypto";
import { describe, expect, it } from "vitest";

import { assertEnvelopeBlobs, toUint8Array } from "../sqlite-utils.js";

describe("toUint8Array", () => {
  it("returns same reference for plain Uint8Array", () => {
    const buf = new Uint8Array([1, 2, 3]);
    expect(toUint8Array(buf)).toBe(buf);
  });

  it("copies Buffer subclass to plain Uint8Array", () => {
    // Buffer extends Uint8Array but has a different constructor
    const buf = Buffer.from([1, 2, 3]);
    const result = toUint8Array(buf);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.constructor).toBe(Uint8Array);
    expect(result).not.toBe(buf);
  });

  it("handles empty Uint8Array", () => {
    const buf = new Uint8Array([]);
    expect(toUint8Array(buf)).toBe(buf);
  });

  it("handles empty Buffer", () => {
    const buf = Buffer.from([]);
    const result = toUint8Array(buf);
    expect(result.constructor).toBe(Uint8Array);
    expect(result).toHaveLength(0);
  });

  it("preserves byte values during copy", () => {
    const buf = Buffer.from([0, 127, 128, 255]);
    const result = toUint8Array(buf);
    expect(result).toEqual(new Uint8Array([0, 127, 128, 255]));
  });
});

describe("assertEnvelopeBlobs", () => {
  function validRow() {
    return {
      nonce: new Uint8Array(AEAD_NONCE_BYTES),
      signature: new Uint8Array(SIGN_BYTES),
      author_public_key: new Uint8Array(SIGN_PUBLIC_KEY_BYTES),
    };
  }

  it("returns asserted blobs for valid row", () => {
    const row = validRow();
    const result = assertEnvelopeBlobs(row);
    expect(result.nonce).toHaveLength(AEAD_NONCE_BYTES);
    expect(result.signature).toHaveLength(SIGN_BYTES);
    expect(result.authorPublicKey).toHaveLength(SIGN_PUBLIC_KEY_BYTES);
  });

  it("normalises Buffer subclasses to plain Uint8Array", () => {
    const row = {
      nonce: Buffer.alloc(AEAD_NONCE_BYTES),
      signature: Buffer.alloc(SIGN_BYTES),
      author_public_key: Buffer.alloc(SIGN_PUBLIC_KEY_BYTES),
    };
    const result = assertEnvelopeBlobs(row);
    expect(result.nonce.constructor).toBe(Uint8Array);
    expect(result.signature.constructor).toBe(Uint8Array);
    expect(result.authorPublicKey.constructor).toBe(Uint8Array);
  });

  it("throws InvalidInputError for wrong-length nonce", () => {
    const row = validRow();
    row.nonce = new Uint8Array(10);
    expect(() => assertEnvelopeBlobs(row)).toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for wrong-length signature", () => {
    const row = validRow();
    row.signature = new Uint8Array(10);
    expect(() => assertEnvelopeBlobs(row)).toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for wrong-length author public key", () => {
    const row = validRow();
    row.author_public_key = new Uint8Array(10);
    expect(() => assertEnvelopeBlobs(row)).toThrow(InvalidInputError);
  });
});
