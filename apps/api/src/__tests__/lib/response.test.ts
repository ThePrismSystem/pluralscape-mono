import { describe, expect, it } from "vitest";

import { wrapAction, wrapResult } from "../../lib/response.js";

describe("wrapResult", () => {
  it("wraps data in a { data } envelope", () => {
    const result = wrapResult({ items: [1, 2, 3] });
    expect(result).toEqual({ data: { items: [1, 2, 3] } });
  });

  it("wraps a string value", () => {
    const result = wrapResult("hello");
    expect(result).toEqual({ data: "hello" });
  });

  it("wraps null value", () => {
    const result = wrapResult(null);
    expect(result).toEqual({ data: null });
  });
});

describe("wrapAction", () => {
  it("returns { data: { success: true } } with no arguments", () => {
    const result = wrapAction();
    expect(result).toEqual({ data: { success: true } });
  });

  it("merges details into the action result", () => {
    const result = wrapAction({ revokedCount: 3 });
    expect(result).toEqual({ data: { success: true, revokedCount: 3 } });
  });

  it("merges multiple detail fields", () => {
    const result = wrapAction({ count: 5, label: "test" });
    expect(result).toEqual({ data: { success: true, count: 5, label: "test" } });
  });
});
