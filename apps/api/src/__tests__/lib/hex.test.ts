import { describe, expect, it } from "vitest";

import { fromHex, toHex } from "../../lib/hex.js";

describe("toHex", () => {
  it("returns empty string for empty array", () => {
    expect(toHex(new Uint8Array([]))).toBe("");
  });

  it("encodes a single zero byte as '00'", () => {
    expect(toHex(new Uint8Array([0]))).toBe("00");
  });

  it("encodes 0xff as 'ff'", () => {
    expect(toHex(new Uint8Array([255]))).toBe("ff");
  });

  it("encodes multi-byte input correctly", () => {
    expect(toHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
  });

  it("zero-pads single-digit hex values", () => {
    expect(toHex(new Uint8Array([0x01, 0x0a]))).toBe("010a");
  });
});

describe("fromHex", () => {
  it("returns empty array for empty string", () => {
    expect(fromHex("")).toEqual(new Uint8Array([]));
  });

  it("decodes '00' as [0]", () => {
    expect(fromHex("00")).toEqual(new Uint8Array([0]));
  });

  it("decodes 'ff' as [255]", () => {
    expect(fromHex("ff")).toEqual(new Uint8Array([255]));
  });

  it("decodes 'deadbeef' correctly", () => {
    expect(fromHex("deadbeef")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it("handles uppercase hex", () => {
    expect(fromHex("DEADBEEF")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it("throws on odd-length hex string", () => {
    expect(() => fromHex("abc")).toThrow("Invalid hex string");
  });

  it("throws on non-hex characters", () => {
    expect(() => fromHex("ghij")).toThrow("Invalid hex string");
  });

  it("roundtrips with toHex", () => {
    const original = new Uint8Array([1, 127, 255, 0, 42]);
    expect(fromHex(toHex(original))).toEqual(original);
  });
});
