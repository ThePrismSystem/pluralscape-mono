import { describe, expect, it } from "vitest";

import { parseHexColor, summarizeMissingRefs, toRecord } from "../helpers.js";

describe("toRecord()", () => {
  it("passes through a plain object", () => {
    const obj = { a: 1, b: "two" };
    expect(toRecord(obj)).toBe(obj);
  });

  it("passes through an empty object", () => {
    const obj = {};
    expect(toRecord(obj)).toBe(obj);
  });

  it("passes through an array (arrays are objects)", () => {
    const arr = [1, 2, 3];
    expect(toRecord(arr)).toBe(arr);
  });

  it("throws for null", () => {
    expect(() => toRecord(null)).toThrow("toRecord expected a non-null object, got null");
  });

  it("throws for a number", () => {
    expect(() => toRecord(42)).toThrow("toRecord expected a non-null object, got number");
  });

  it("throws for a string", () => {
    expect(() => toRecord("hello")).toThrow("toRecord expected a non-null object, got string");
  });

  it("throws for undefined", () => {
    expect(() => toRecord(undefined)).toThrow("toRecord expected a non-null object, got undefined");
  });

  it("throws for a boolean", () => {
    expect(() => toRecord(true)).toThrow("toRecord expected a non-null object, got boolean");
  });
});

describe("summarizeMissingRefs()", () => {
  it("shows all refs when 5 or fewer", () => {
    expect(summarizeMissingRefs(["a", "b", "c"])).toBe("a, b, c");
  });

  it("shows exactly 5 refs without truncation", () => {
    expect(summarizeMissingRefs(["a", "b", "c", "d", "e"])).toBe("a, b, c, d, e");
  });

  it("shows first 5 + 'and N more' for >5 refs", () => {
    expect(summarizeMissingRefs(["a", "b", "c", "d", "e", "f"])).toBe("a, b, c, d, e, and 1 more");
  });

  it("handles large lists", () => {
    const refs = Array.from({ length: 100 }, (_, i) => `ref-${String(i)}`);
    const result = summarizeMissingRefs(refs);
    expect(result).toContain("and 95 more");
    expect(result).toContain("ref-0");
    expect(result).toContain("ref-4");
    expect(result).not.toContain("ref-5");
  });

  it("handles empty list", () => {
    expect(summarizeMissingRefs([])).toBe("");
  });

  it("handles single ref", () => {
    expect(summarizeMissingRefs(["only"])).toBe("only");
  });
});

describe("parseHexColor()", () => {
  it("parses valid #RGB", () => {
    expect(parseHexColor("#f0a")).toBe("#f0a");
  });

  it("parses valid #RRGGBB", () => {
    expect(parseHexColor("#ff00aa")).toBe("#ff00aa");
  });

  it("parses valid #RRGGBBAA", () => {
    expect(parseHexColor("#ff00aacc")).toBe("#ff00aacc");
  });

  it("parses uppercase hex", () => {
    expect(parseHexColor("#FF00AA")).toBe("#FF00AA");
  });

  it("parses mixed case hex", () => {
    expect(parseHexColor("#Ff0aBC")).toBe("#Ff0aBC");
  });

  it("returns null for missing hash prefix", () => {
    expect(parseHexColor("ff00aa")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseHexColor(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseHexColor(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHexColor("")).toBeNull();
  });

  it("returns null for invalid hex characters", () => {
    expect(parseHexColor("#gggggg")).toBeNull();
  });

  it("returns null for wrong length", () => {
    expect(parseHexColor("#ff0")).not.toBeNull(); // 3 is valid
    expect(parseHexColor("#ff00")).toBeNull(); // 4 is not valid
    expect(parseHexColor("#ff00a")).toBeNull(); // 5 is not valid
    expect(parseHexColor("#ff00aab")).toBeNull(); // 7 is not valid
    expect(parseHexColor("#ff00aabbc")).toBeNull(); // 9 is not valid
  });

  it("returns null for random strings", () => {
    expect(parseHexColor("not-a-color")).toBeNull();
    expect(parseHexColor("rgb(255,0,0)")).toBeNull();
  });
});
