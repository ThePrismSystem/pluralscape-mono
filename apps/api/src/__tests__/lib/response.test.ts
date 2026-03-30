import { describe, expect, expectTypeOf, it } from "vitest";

import { envelope } from "../../lib/response.js";

describe("envelope", () => {
  it("wraps data in a { data } envelope", () => {
    const result = envelope({ items: [1, 2, 3] });
    expect(result).toEqual({ data: { items: [1, 2, 3] } });
  });

  it("wraps a string value", () => {
    const result = envelope("hello");
    expect(result).toEqual({ data: "hello" });
  });

  it("wraps null value", () => {
    const result = envelope(null);
    expect(result).toEqual({ data: null });
  });

  it("wraps undefined value", () => {
    const result = envelope(undefined);
    expect(result).toEqual({ data: undefined });
  });

  it("infers return type correctly", () => {
    const result = envelope({ id: 1 });
    expectTypeOf(result).toEqualTypeOf<{ readonly data: { id: number } }>();
  });
});
