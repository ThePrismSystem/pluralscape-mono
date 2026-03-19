import { describe, expect, expectTypeOf, it } from "vitest";

import { wrapAction, wrapResult } from "../../lib/response.js";

import type { ActionResult } from "@pluralscape/types";

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

  it("wraps undefined value", () => {
    const result = wrapResult(undefined);
    expect(result).toEqual({ data: undefined });
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

  it("returns same shape as no-arg for empty object", () => {
    const result = wrapAction({});
    expect(result).toEqual({ data: { success: true } });
  });

  it("infers ActionResult return type with no arguments", () => {
    const result = wrapAction();
    expectTypeOf(result).toEqualTypeOf<{ readonly data: ActionResult }>();
  });

  it("infers ActionResult & details return type with arguments", () => {
    const result = wrapAction({ revokedCount: 3 });
    expectTypeOf(result).toEqualTypeOf<{
      readonly data: ActionResult & { revokedCount: number };
    }>();
  });
});
