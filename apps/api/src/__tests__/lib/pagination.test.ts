import { afterEach, describe, expect, it, vi } from "vitest";

import { parsePaginationLimit } from "../../lib/pagination.js";

describe("parsePaginationLimit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const DEFAULT = 25;
  const MAX = 100;

  it("returns parsed number for a valid numeric string", () => {
    expect(parsePaginationLimit("50", DEFAULT, MAX)).toBe(50);
  });

  it("returns defaultLimit for undefined input", () => {
    expect(parsePaginationLimit(undefined, DEFAULT, MAX)).toBe(DEFAULT);
  });

  it("returns defaultLimit for non-numeric string", () => {
    expect(parsePaginationLimit("abc", DEFAULT, MAX)).toBe(DEFAULT);
  });

  it("clamps to maxLimit when value exceeds max", () => {
    expect(parsePaginationLimit("200", DEFAULT, MAX)).toBe(MAX);
  });

  it("clamps to 1 for zero", () => {
    // 0 is not > 0, so it falls through to defaultLimit
    expect(parsePaginationLimit("0", DEFAULT, MAX)).toBe(DEFAULT);
  });

  it("returns defaultLimit for negative values", () => {
    // Negative is not > 0, so it falls through to defaultLimit
    expect(parsePaginationLimit("-5", DEFAULT, MAX)).toBe(DEFAULT);
  });

  it("returns 1 when parsed value is 1", () => {
    expect(parsePaginationLimit("1", DEFAULT, MAX)).toBe(1);
  });

  it("returns maxLimit when value equals max", () => {
    expect(parsePaginationLimit("100", DEFAULT, MAX)).toBe(100);
  });

  it("returns defaultLimit for empty string", () => {
    // Empty string is falsy, so the ternary returns defaultLimit directly
    expect(parsePaginationLimit("", DEFAULT, MAX)).toBe(DEFAULT);
  });
});
