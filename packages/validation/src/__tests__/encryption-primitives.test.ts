import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { Base64ToUint8ArrayCodec } from "../encryption-primitives.js";

describe("Base64ToUint8ArrayCodec", () => {
  it("decodes a base64 string to a Uint8Array", () => {
    const result = z.decode(Base64ToUint8ArrayCodec, "AAECAw==");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([0, 1, 2, 3]);
  });

  it("encodes a Uint8Array to a base64 string", () => {
    const result = z.encode(Base64ToUint8ArrayCodec, new Uint8Array([0, 1, 2, 3]));
    expect(result).toBe("AAECAw==");
  });

  it("round-trips arbitrary bytes losslessly", () => {
    const original = new Uint8Array(32);
    for (let i = 0; i < original.length; i++) original[i] = (i * 7 + 13) & 0xff;
    const wire = z.encode(Base64ToUint8ArrayCodec, original);
    const back = z.decode(Base64ToUint8ArrayCodec, wire);
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it("rejects an invalid base64 string", () => {
    const result = z.safeDecode(Base64ToUint8ArrayCodec, "not-base64!!!");
    expect(result.success).toBe(false);
  });
});
