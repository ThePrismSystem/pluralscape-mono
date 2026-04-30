/**
 * Row transform primitive helper tests.
 *
 * Covers: RowTransformError, intToBoolFailClosed, parseJsonSafe, guardedStr,
 *         guardedNum, guardedToMs
 * Companion files: row-transforms-member-fronting.test.ts,
 *                  row-transforms-comms.test.ts,
 *                  row-transforms-structure-innerworld.test.ts,
 *                  row-transforms-misc.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  RowTransformError,
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBoolFailClosed,
  parseJsonSafe,
} from "../../row-transforms/index.js";

describe("RowTransformError", () => {
  it("captures table, field, and rowId context", () => {
    const err = new RowTransformError("members", "name", "mem-1", "expected string");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RowTransformError");
    expect(err.table).toBe("members");
    expect(err.field).toBe("name");
    expect(err.rowId).toBe("mem-1");
    expect(err.message).toBe("members.name (row mem-1): expected string");
  });

  it("formats message without rowId", () => {
    const err = new RowTransformError("members", "name", null, "bad");
    expect(err.message).toBe("members.name: bad");
  });
});

describe("intToBoolFailClosed", () => {
  it("returns true for null (fail-closed)", () => {
    expect(intToBoolFailClosed(null)).toBe(true);
  });

  it("returns true for undefined (fail-closed)", () => {
    expect(intToBoolFailClosed(undefined)).toBe(true);
  });

  it("returns false for 0", () => {
    expect(intToBoolFailClosed(0)).toBe(false);
  });

  it("returns true for 1", () => {
    expect(intToBoolFailClosed(1)).toBe(true);
  });

  it("returns true for boolean true", () => {
    expect(intToBoolFailClosed(true)).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(intToBoolFailClosed(false)).toBe(false);
  });
});

describe("parseJsonSafe", () => {
  it("parses valid JSON string", () => {
    expect(parseJsonSafe('["a","b"]', "t", "f")).toEqual(["a", "b"]);
  });

  it("returns null for null input", () => {
    expect(parseJsonSafe(null, "t", "f")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseJsonSafe(undefined, "t", "f")).toBeNull();
  });

  it("passes non-string values through", () => {
    expect(parseJsonSafe(42, "t", "f")).toBe(42);
  });

  it("throws RowTransformError for malformed JSON", () => {
    expect(() => parseJsonSafe("{broken", "members", "tags", "mem-1")).toThrow(RowTransformError);
  });

  it("includes table/field context in error", () => {
    try {
      parseJsonSafe("{broken", "members", "tags", "mem-1");
      expect.fail("Expected to throw");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(RowTransformError);
      if (!(e instanceof RowTransformError)) throw e;
      expect(e.table).toBe("members");
      expect(e.field).toBe("tags");
      expect(e.rowId).toBe("mem-1");
    }
  });

  it("truncates long values in error message", () => {
    const longJson = "{" + "x".repeat(200);
    try {
      parseJsonSafe(longJson, "t", "f");
      expect.fail("Expected to throw");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(Error);
      if (!(e instanceof Error)) throw e;
      expect(e.message).toContain("…");
      expect(e.message.length).toBeLessThan(200);
    }
  });
});

describe("guardedStr", () => {
  it("passes valid strings through", () => {
    expect(guardedStr("hello", "t", "f")).toBe("hello");
  });

  it("throws RowTransformError for numbers", () => {
    expect(() => guardedStr(123, "members", "name", "mem-1")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedStr(null, "members", "name")).toThrow(RowTransformError);
  });
});

describe("guardedNum", () => {
  it("passes valid numbers through", () => {
    expect(guardedNum(42, "t", "f")).toBe(42);
  });

  it("throws RowTransformError for strings", () => {
    expect(() => guardedNum("abc", "members", "sort_order")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedNum(null, "members", "sort_order")).toThrow(RowTransformError);
  });
});

describe("guardedToMs", () => {
  it("passes valid numbers as UnixMillis", () => {
    expect(guardedToMs(1_700_000_000_000, "t", "f")).toBe(1_700_000_000_000);
  });

  it("throws RowTransformError for strings", () => {
    expect(() => guardedToMs("abc", "members", "created_at")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedToMs(null, "members", "created_at")).toThrow(RowTransformError);
  });
});
