import { describe, expect, it } from "vitest";

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { isUniqueViolation, throwOnUniqueViolation } from "../../lib/unique-violation.js";

describe("isUniqueViolation", () => {
  it("returns true for an Error with PG unique violation code", () => {
    const err = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("returns false for an Error with a different code", () => {
    const err = Object.assign(new Error("foreign_key_violation"), { code: "23503" });
    expect(isUniqueViolation(err)).toBe(false);
  });

  it("returns false for a plain Error without a code property", () => {
    expect(isUniqueViolation(new Error("generic error"))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isUniqueViolation("string")).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(false);
  });

  it("returns true when the unique violation code is on the cause (DrizzleQueryError)", () => {
    const pgError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    const wrapper = new Error("Failed query: INSERT INTO ...");
    wrapper.cause = pgError;
    expect(isUniqueViolation(wrapper)).toBe(true);
  });

  it("returns false when the cause has a different code", () => {
    const pgError = Object.assign(new Error("foreign_key_violation"), { code: "23503" });
    const wrapper = new Error("Failed query");
    wrapper.cause = pgError;
    expect(isUniqueViolation(wrapper)).toBe(false);
  });

  it("returns true when the unique violation is deeply nested in cause chain", () => {
    const pgError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    const mid = new Error("middleware error");
    mid.cause = pgError;
    const outer = new Error("outer wrapper");
    outer.cause = mid;
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it("returns false when no cause in the chain has the unique violation code", () => {
    const inner = Object.assign(new Error("other"), { code: "23503" });
    const mid = new Error("middleware");
    mid.cause = inner;
    const outer = new Error("outer");
    outer.cause = mid;
    expect(isUniqueViolation(outer)).toBe(false);
  });
});

describe("throwOnUniqueViolation", () => {
  it("throws a 409 ApiHttpError for a unique violation", () => {
    const err = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });

    expect(() => throwOnUniqueViolation(err, "Already exists")).toThrow(
      expect.objectContaining({
        status: 409,
        code: "CONFLICT",
        message: "Already exists",
      }),
    );
  });

  it("re-throws the original error for non-unique-violation errors", () => {
    const err = new TypeError("something else");

    expect(() => throwOnUniqueViolation(err, "Already exists")).toThrow(err);
  });

  it("re-throws non-Error values unchanged", () => {
    const err = Object.assign(new Error("other pg error"), { code: "23503" });

    expect(() => throwOnUniqueViolation(err, "Already exists")).toThrow(err);
    try {
      throwOnUniqueViolation(err, "Already exists");
    } catch (thrown) {
      expect(thrown).toBe(err);
      expect(thrown).not.toBeInstanceOf(ApiHttpError);
    }
  });
});
