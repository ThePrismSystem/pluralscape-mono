import { describe, expect, it } from "vitest";

import { PG_FK_VIOLATION, PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { isFkViolation, isPgErrorCode } from "../../lib/pg-error.js";

describe("isPgErrorCode", () => {
  it("returns true for an Error with the matching code", () => {
    const err = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    expect(isPgErrorCode(err, PG_UNIQUE_VIOLATION)).toBe(true);
  });

  it("returns false for an Error with a different code", () => {
    const err = Object.assign(new Error("other"), { code: PG_FK_VIOLATION });
    expect(isPgErrorCode(err, PG_UNIQUE_VIOLATION)).toBe(false);
  });

  it("returns false for an Error without a code property", () => {
    expect(isPgErrorCode(new Error("generic"), PG_UNIQUE_VIOLATION)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isPgErrorCode("string", PG_UNIQUE_VIOLATION)).toBe(false);
    expect(isPgErrorCode(null, PG_UNIQUE_VIOLATION)).toBe(false);
    expect(isPgErrorCode(undefined, PG_UNIQUE_VIOLATION)).toBe(false);
    expect(isPgErrorCode({ code: PG_UNIQUE_VIOLATION }, PG_UNIQUE_VIOLATION)).toBe(false);
  });

  it("returns true when the matching code is on the cause (DrizzleQueryError)", () => {
    const pgError = Object.assign(new Error("fk_violation"), { code: PG_FK_VIOLATION });
    const wrapper = new Error("Failed query");
    wrapper.cause = pgError;
    expect(isPgErrorCode(wrapper, PG_FK_VIOLATION)).toBe(true);
  });

  it("returns false when the cause has a different code", () => {
    const pgError = Object.assign(new Error("fk_violation"), { code: PG_FK_VIOLATION });
    const wrapper = new Error("Failed query");
    wrapper.cause = pgError;
    expect(isPgErrorCode(wrapper, PG_UNIQUE_VIOLATION)).toBe(false);
  });

  it("returns true when the matching code is deeply nested in cause chain", () => {
    const pgError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    const mid = new Error("middleware error");
    mid.cause = pgError;
    const outer = new Error("outer wrapper");
    outer.cause = mid;
    expect(isPgErrorCode(outer, PG_UNIQUE_VIOLATION)).toBe(true);
  });

  it("returns false after exceeding max cause depth", () => {
    // Build a chain deeper than 10
    let current: Error = Object.assign(new Error("deep"), { code: PG_UNIQUE_VIOLATION });
    for (let i = 0; i < 15; i++) {
      const wrapper = new Error(`wrapper-${String(i)}`);
      wrapper.cause = current;
      current = wrapper;
    }
    // The code is at depth 16, beyond the 10-depth limit
    expect(isPgErrorCode(current, PG_UNIQUE_VIOLATION)).toBe(false);
  });
});

describe("isFkViolation", () => {
  it("returns true for an FK violation error", () => {
    const err = Object.assign(new Error("fk_violation"), { code: PG_FK_VIOLATION });
    expect(isFkViolation(err)).toBe(true);
  });

  it("returns false for a unique violation error", () => {
    const err = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    expect(isFkViolation(err)).toBe(false);
  });

  it("returns true when FK violation code is in cause chain", () => {
    const pgError = Object.assign(new Error("fk_violation"), { code: PG_FK_VIOLATION });
    const wrapper = new Error("Failed query");
    wrapper.cause = pgError;
    expect(isFkViolation(wrapper)).toBe(true);
  });

  it("returns false for non-Error values", () => {
    expect(isFkViolation(null)).toBe(false);
    expect(isFkViolation("string")).toBe(false);
  });
});
