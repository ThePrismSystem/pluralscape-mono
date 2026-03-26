import { describe, expect, it } from "vitest";

import { parseQuery } from "../../lib/query-parse.js";

const TestSchema = {
  safeParse(data: unknown) {
    const obj = data as Record<string, unknown>;
    if (obj["name"] === "valid") {
      return { success: true as const, data: { name: "valid" } };
    }
    return { success: false as const, error: { issues: [{ message: "invalid name" }] } };
  },
};

describe("parseQuery", () => {
  it("returns parsed data on valid input", () => {
    const result = parseQuery(TestSchema, { name: "valid" });
    expect(result).toEqual({ name: "valid" });
  });

  it("throws ApiHttpError with 400 on invalid input", () => {
    expect(() => parseQuery(TestSchema, { name: "bad" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("includes validation issues in error details", () => {
    try {
      parseQuery(TestSchema, { name: "bad" });
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const error = err as { details: { issues: unknown[] } };
      expect(error.details.issues).toEqual([{ message: "invalid name" }]);
    }
  });
});
