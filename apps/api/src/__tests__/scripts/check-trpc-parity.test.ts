import { describe, expect, it } from "vitest";

import type { ParityFailure } from "../../../scripts/trpc-parity-lib.js";
import { extractBalancedBlock, walkRouteTree } from "../../../scripts/trpc-parity-lib.js";

describe("extractBalancedBlock", () => {
  it("extracts simple balanced braces", () => {
    expect(extractBalancedBlock("{ a: 1 }", 0)).toBe(" a: 1 ");
  });

  it("returns null when index is not an opening brace", () => {
    expect(extractBalancedBlock("abc", 0)).toBeNull();
  });

  it("returns null for unbalanced braces", () => {
    expect(extractBalancedBlock("{ a: {", 0)).toBeNull();
  });

  it("handles nested braces", () => {
    expect(extractBalancedBlock("{ a: { b: 1 } }", 0)).toBe(" a: { b: 1 } ");
  });

  it("ignores braces inside double-quoted strings", () => {
    expect(extractBalancedBlock('{ msg: "use { carefully }" }', 0)).toBe(
      ' msg: "use { carefully }" ',
    );
  });

  it("ignores braces inside single-quoted strings", () => {
    expect(extractBalancedBlock("{ msg: 'test { brace }' }", 0)).toBe(" msg: 'test { brace }' ");
  });

  it("ignores braces inside template literals", () => {
    expect(extractBalancedBlock("{ msg: `${a} and {b}` }", 0)).toBe(" msg: `${a} and {b}` ");
  });

  it("ignores braces inside single-line comments", () => {
    expect(extractBalancedBlock("{ a: 1, // { not a brace\nb: 2 }", 0)).toBe(
      " a: 1, // { not a brace\nb: 2 ",
    );
  });

  it("ignores braces inside multi-line comments", () => {
    expect(extractBalancedBlock("{ a: 1, /* { not } a { brace */ b: 2 }", 0)).toBe(
      " a: 1, /* { not } a { brace */ b: 2 ",
    );
  });
});

describe("walkRouteTree", () => {
  it("records a failure when a route file cannot be read", () => {
    const failures: ParityFailure[] = [];
    const result = walkRouteTree("/nonexistent/file.ts", "/v1", false, failures);
    expect(result).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.dimension).toBe("existence");
    expect(failures[0]?.actual).toContain("not readable");
  });
});
