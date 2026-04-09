import { describe, expect, it } from "vitest";

import { assertBrandedTargetId, InvalidBrandedIdError } from "../assert-branded.js";

describe("assertBrandedTargetId", () => {
  it("returns the input as a branded ID for valid entity type and non-empty string", () => {
    const id = assertBrandedTargetId("member", "01H_ULID_VALID");
    expect(id).toBe("01H_ULID_VALID");
  });

  it("throws InvalidBrandedIdError for an empty string", () => {
    expect(() => assertBrandedTargetId("member", "")).toThrow(InvalidBrandedIdError);
  });

  it("throws InvalidBrandedIdError for non-string input", () => {
    expect(() => assertBrandedTargetId("member", 123)).toThrow(InvalidBrandedIdError);
  });

  it("throws InvalidBrandedIdError for null input", () => {
    expect(() => assertBrandedTargetId("member", null)).toThrow(InvalidBrandedIdError);
  });

  it("throws InvalidBrandedIdError for undefined input", () => {
    expect(() => assertBrandedTargetId("member", undefined)).toThrow(InvalidBrandedIdError);
  });

  it("carries entityType and rawId on the error", () => {
    try {
      assertBrandedTargetId("group", "");
      throw new Error("expected assertBrandedTargetId to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidBrandedIdError);
      if (err instanceof InvalidBrandedIdError) {
        expect(err.entityType).toBe("group");
        expect(err.rawId).toBe("");
      }
    }
  });

  it("includes the entity type in the error message", () => {
    try {
      assertBrandedTargetId("custom-front", 42);
      throw new Error("expected assertBrandedTargetId to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidBrandedIdError);
      if (err instanceof InvalidBrandedIdError) {
        expect(err.message).toContain("custom-front");
        expect(err.message).toContain("42");
      }
    }
  });
});
