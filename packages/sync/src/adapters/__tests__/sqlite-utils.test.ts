import { describe, expect, it } from "vitest";

import { toUint8Array } from "../sqlite-utils.js";

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
