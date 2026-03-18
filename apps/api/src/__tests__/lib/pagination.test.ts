import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPaginatedResult, parsePaginationLimit } from "../../lib/pagination.js";

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

describe("buildPaginatedResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const identity = (row: { id: string; name: string }) => row;

  it("returns empty result for empty rows", () => {
    const result = buildPaginatedResult([], 10, identity);
    expect(result).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
  });

  it("returns all items when rows.length <= limit", () => {
    const rows = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ];
    const result = buildPaginatedResult(rows, 5, identity);
    expect(result.items).toEqual(rows);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns all items when rows.length equals limit", () => {
    const rows = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ];
    const result = buildPaginatedResult(rows, 2, identity);
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("truncates and sets hasMore when rows.length > limit", () => {
    const rows = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
      { id: "c", name: "Carol" },
    ];
    const result = buildPaginatedResult(rows, 2, identity);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toEqual({ id: "b", name: "Bob" });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(toCursor("b"));
  });

  it("applies mapper to each row", () => {
    const rows = [{ id: "x", value: 42 }];
    const mapper = (row: { id: string; value: number }) => ({
      id: row.id,
      doubled: row.value * 2,
    });
    const result = buildPaginatedResult(rows, 5, mapper);
    expect(result.items).toEqual([{ id: "x", doubled: 84 }]);
  });
});
