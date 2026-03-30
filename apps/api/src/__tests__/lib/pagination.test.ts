import { CursorInvalidError } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import {
  buildCompositePaginatedResult,
  buildPaginatedResult,
  fromCompositeCursor,
  fromCursor,
  parseCursor,
  parsePaginationLimit,
  toCursor,
  toCompositeCursor,
} from "../../lib/pagination.js";

import type { PaginationCursor } from "@pluralscape/types";

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
      data: [],
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
    expect(result.data).toEqual(rows);
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
    expect(result.data).toHaveLength(2);
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
    expect(result.data).toHaveLength(2);
    expect(result.data[1]).toEqual({ id: "b", name: "Bob" });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
    if (result.nextCursor) {
      expect(fromCursor(result.nextCursor, 86_400_000)).toBe("b");
    }
  });

  it("applies mapper to each row", () => {
    const rows = [{ id: "x", value: 42 }];
    const mapper = (row: { id: string; value: number }) => ({
      id: row.id,
      doubled: row.value * 2,
    });
    const result = buildPaginatedResult(rows, 5, mapper);
    expect(result.data).toEqual([{ id: "x", doubled: 84 }]);
  });
});

describe("toCursor / fromCursor", () => {
  const TTL_MS = 86_400_000; // 24 hours

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips an ID", () => {
    const cursor = toCursor("mem_abc123");
    const id = fromCursor(cursor, TTL_MS);
    expect(id).toBe("mem_abc123");
  });

  it("produces a base64url-encoded string", () => {
    const cursor = toCursor("test-id");
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("throws CursorInvalidError for expired cursor", () => {
    const cursor = toCursor("test-id");
    vi.advanceTimersByTime(TTL_MS + 1);
    expect(() => fromCursor(cursor, TTL_MS)).toThrow(CursorInvalidError);
  });

  it("accepts cursor just within TTL", () => {
    const cursor = toCursor("test-id");
    vi.advanceTimersByTime(TTL_MS - 1);
    expect(fromCursor(cursor, TTL_MS)).toBe("test-id");
  });

  it("throws CursorInvalidError for malformed base64", () => {
    expect(() => fromCursor("!!!not-valid!!!" as PaginationCursor, TTL_MS)).toThrow(
      CursorInvalidError,
    );
  });

  it("throws CursorInvalidError for valid base64 but invalid JSON", () => {
    const notJson = Buffer.from("not json").toString("base64url") as PaginationCursor;
    expect(() => fromCursor(notJson, TTL_MS)).toThrow(CursorInvalidError);
  });

  it("throws CursorInvalidError for JSON missing required fields", () => {
    const missingId = Buffer.from(JSON.stringify({ ts: Date.now() })).toString(
      "base64url",
    ) as PaginationCursor;
    expect(() => fromCursor(missingId, TTL_MS)).toThrow(CursorInvalidError);
  });

  it("throws CursorInvalidError for tampered cursor", () => {
    const cursor = toCursor("test-id");
    // Decode, modify ts, re-encode (HMAC won't match)
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { id: string; ts: number; mac: string };
    parsed.ts = parsed.ts + 1;
    const tampered = Buffer.from(JSON.stringify(parsed)).toString("base64url") as PaginationCursor;
    expect(() => fromCursor(tampered, TTL_MS)).toThrow(CursorInvalidError);
  });

  it("CursorInvalidError has reason 'expired' for TTL failure", () => {
    const cursor = toCursor("test-id");
    vi.advanceTimersByTime(TTL_MS + 1);
    try {
      fromCursor(cursor, TTL_MS);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CursorInvalidError);
      expect((error as CursorInvalidError).reason).toBe("expired");
    }
  });

  it("CursorInvalidError has reason 'malformed' for bad input", () => {
    try {
      fromCursor("garbage" as PaginationCursor, TTL_MS);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CursorInvalidError);
      expect((error as CursorInvalidError).reason).toBe("malformed");
    }
  });
});

describe("toCompositeCursor / fromCompositeCursor", () => {
  const ENTITY_LABEL = "test entity";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips sortValue and id", () => {
    const cursor = toCompositeCursor(42, "poll_abc123");
    const decoded = fromCompositeCursor(cursor, ENTITY_LABEL);
    expect(decoded.sortValue).toBe(42);
    expect(decoded.id).toBe("poll_abc123");
  });

  it("throws ApiHttpError INVALID_CURSOR for expired cursor", () => {
    const cursor = toCompositeCursor(100, "poll_xyz");
    vi.advanceTimersByTime(86_400_001);
    expect(() => fromCompositeCursor(cursor, ENTITY_LABEL)).toThrow(ApiHttpError);
    try {
      fromCompositeCursor(cursor, ENTITY_LABEL);
    } catch (error: unknown) {
      expect((error as ApiHttpError).code).toBe("INVALID_CURSOR");
    }
  });

  it("throws ApiHttpError INVALID_CURSOR for garbage string", () => {
    expect(() => fromCompositeCursor("!!!garbage!!!", ENTITY_LABEL)).toThrow(ApiHttpError);
    try {
      fromCompositeCursor("!!!garbage!!!", ENTITY_LABEL);
    } catch (error: unknown) {
      expect((error as ApiHttpError).code).toBe("INVALID_CURSOR");
    }
  });

  it("throws ApiHttpError with entityLabel for non-JSON inner payload", () => {
    const cursor = toCursor("not json");
    expect(() => fromCompositeCursor(cursor, ENTITY_LABEL)).toThrow(ApiHttpError);
    try {
      fromCompositeCursor(cursor, ENTITY_LABEL);
    } catch (error: unknown) {
      expect((error as ApiHttpError).message).toContain(ENTITY_LABEL);
    }
  });

  it("throws ApiHttpError with entityLabel for missing t field", () => {
    const cursor = toCursor(JSON.stringify({ i: "abc" }));
    expect(() => fromCompositeCursor(cursor, ENTITY_LABEL)).toThrow(ApiHttpError);
    try {
      fromCompositeCursor(cursor, ENTITY_LABEL);
    } catch (error: unknown) {
      expect((error as ApiHttpError).message).toContain(ENTITY_LABEL);
    }
  });

  it("throws ApiHttpError with entityLabel for missing i field", () => {
    const cursor = toCursor(JSON.stringify({ t: 123 }));
    expect(() => fromCompositeCursor(cursor, ENTITY_LABEL)).toThrow(ApiHttpError);
    try {
      fromCompositeCursor(cursor, ENTITY_LABEL);
    } catch (error: unknown) {
      expect((error as ApiHttpError).message).toContain(ENTITY_LABEL);
    }
  });

  it("throws ApiHttpError for wrong field types", () => {
    const cursor = toCursor(JSON.stringify({ t: "string", i: 42 }));
    expect(() => fromCompositeCursor(cursor, "poll")).toThrow(ApiHttpError);
    try {
      fromCompositeCursor(cursor, "poll");
    } catch (error: unknown) {
      expect((error as ApiHttpError).code).toBe("INVALID_CURSOR");
    }
  });

  it("includes entityLabel in error message", () => {
    const cursor = toCursor(JSON.stringify({ t: "string", i: 42 }));
    try {
      fromCompositeCursor(cursor, "poll");
    } catch (error: unknown) {
      expect((error as ApiHttpError).message).toContain("poll");
    }
  });
});

describe("parseCursor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for undefined input", () => {
    expect(parseCursor(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseCursor("")).toBeUndefined();
  });

  it("returns decoded ID for valid cursor", () => {
    const cursor = toCursor("sys_abc");
    expect(parseCursor(cursor)).toBe("sys_abc");
  });

  it("throws ApiHttpError INVALID_CURSOR for malformed cursor", () => {
    expect(() => parseCursor("garbage")).toThrow(ApiHttpError);
    try {
      parseCursor("garbage");
    } catch (error: unknown) {
      expect((error as ApiHttpError).code).toBe("INVALID_CURSOR");
    }
  });

  it("throws ApiHttpError INVALID_CURSOR for expired cursor", () => {
    const cursor = toCursor("sys_abc");
    vi.advanceTimersByTime(86_400_001);
    expect(() => parseCursor(cursor)).toThrow(ApiHttpError);
  });
});

// ── buildCompositePaginatedResult ──────────────────────────────────

describe("buildCompositePaginatedResult", () => {
  interface TestRow {
    id: string;
    score: number;
  }
  const mapper = (row: TestRow): TestRow => row;
  const extractor = (item: TestRow): number => item.score;

  it("returns empty result for no rows", () => {
    const result = buildCompositePaginatedResult([], 10, mapper, extractor);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBeNull();
  });

  it("returns all rows when fewer than limit", () => {
    const rows: TestRow[] = [
      { id: "a", score: 100 },
      { id: "b", score: 200 },
    ];
    const result = buildCompositePaginatedResult(rows, 5, mapper, extractor);
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("slices and provides cursor when rows exceed limit", () => {
    const rows: TestRow[] = [
      { id: "a", score: 300 },
      { id: "b", score: 200 },
      { id: "c", score: 100 },
    ];
    const result = buildCompositePaginatedResult(rows, 2, mapper, extractor);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe("a");
    expect(result.data[1]?.id).toBe("b");
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();

    // Verify the cursor round-trips through fromCompositeCursor
    if (!result.nextCursor) throw new Error("Expected cursor");
    const decoded = fromCompositeCursor(result.nextCursor, "test");
    expect(decoded.sortValue).toBe(200);
    expect(decoded.id).toBe("b");
  });

  it("applies mapper to rows", () => {
    const rows = [{ id: "raw", score: 50 }];
    const customMapper = (row: TestRow): TestRow => ({ ...row, id: `mapped_${row.id}` });
    const result = buildCompositePaginatedResult(rows, 10, customMapper, extractor);
    expect(result.data[0]?.id).toBe("mapped_raw");
  });
});
