import { describe, expect, expectTypeOf, it } from "vitest";

import { toChecksumHex } from "../checksum.js";

import type { ChecksumHex } from "../ids.js";

describe("toChecksumHex", () => {
  it("returns a branded ChecksumHex for valid 64-char lowercase hex", () => {
    const hex = "a".repeat(64);
    const result = toChecksumHex(hex);
    expect(result).toBe(hex);
    expectTypeOf(result).toEqualTypeOf<ChecksumHex>();
  });

  it("accepts mixed valid lowercase hex characters", () => {
    const hex = "0123456789abcdef".repeat(4);
    const result = toChecksumHex(hex);
    expect(result).toBe(hex);
    expectTypeOf(result).toEqualTypeOf<ChecksumHex>();
  });

  it("throws on wrong length (too short)", () => {
    expect(() => toChecksumHex("abc")).toThrow("Expected 64-char hex digest, got 3");
  });

  it("throws on wrong length (too long)", () => {
    expect(() => toChecksumHex("a".repeat(65))).toThrow("Expected 64-char hex digest, got 65");
  });

  it("normalizes uppercase hex to lowercase", () => {
    const hex = "A".repeat(64);
    const result = toChecksumHex(hex);
    expect(result).toBe("a".repeat(64));
    expectTypeOf(result).toEqualTypeOf<ChecksumHex>();
  });

  it("normalizes mixed-case hex to lowercase", () => {
    const hex = "aAbBcCdDeEfF0123456789".padEnd(64, "0");
    const result = toChecksumHex(hex);
    expect(result).toBe(hex.toLowerCase());
  });

  it("throws on non-hex characters", () => {
    const hex = "g".repeat(64);
    expect(() => toChecksumHex(hex)).toThrow(
      "Checksum hex digest must contain only hex characters",
    );
  });

  it("throws on empty string", () => {
    expect(() => toChecksumHex("")).toThrow("Expected 64-char hex digest, got 0");
  });
});
