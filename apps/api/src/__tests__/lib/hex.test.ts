import { describe, expect, it } from "vitest";

import { toHex } from "../../lib/hex.js";

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
