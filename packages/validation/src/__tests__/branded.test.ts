import { describe, expect, it } from "vitest";

import { brandedIdQueryParam, optionalBrandedId } from "../branded-id.js";
import { brandedNumber, brandedString } from "../branded.js";

describe("brandedString", () => {
  it("accepts a non-empty string", () => {
    const schema = brandedString<"SystemId">();
    const result = schema.safeParse("sys_abc123");
    expect(result.success).toBe(true);
  });

  it("rejects an empty string", () => {
    const schema = brandedString<"SystemId">();
    const result = schema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects a non-string value", () => {
    const schema = brandedString<"SystemId">();
    const result = schema.safeParse(42);
    expect(result.success).toBe(false);
  });

  it("accepts a whitespace-only string", () => {
    const schema = brandedString<"SystemId">();
    const result = schema.safeParse("   ");
    expect(result.success).toBe(true);
  });
});

describe("brandedNumber", () => {
  it("accepts a number", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(42);
    expect(result.success).toBe(true);
  });

  it("accepts zero", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(0);
    expect(result.success).toBe(true);
  });

  it("rejects a non-number value", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse("not-a-number");
    expect(result.success).toBe(false);
  });

  it("rejects NaN", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(NaN);
    expect(result.success).toBe(false);
  });

  it("rejects Infinity", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(Infinity);
    expect(result.success).toBe(false);
  });

  it("rejects -Infinity", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(-Infinity);
    expect(result.success).toBe(false);
  });
});

describe("optionalBrandedId", () => {
  it("rejects non-string values", () => {
    const schema = optionalBrandedId("mem_");
    expect(schema.safeParse(42).success).toBe(false);
  });

  it("accepts undefined (optional)", () => {
    const schema = optionalBrandedId("mem_");
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid prefixed UUID", () => {
    const schema = optionalBrandedId("mem_");
    expect(schema.safeParse("mem_550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects wrong prefix", () => {
    const schema = optionalBrandedId("mem_");
    expect(schema.safeParse("sys_550e8400-e29b-41d4-a716-446655440000").success).toBe(false);
  });
});

describe("brandedIdQueryParam", () => {
  it("rejects non-string values", () => {
    const schema = brandedIdQueryParam("sys_");
    expect(schema.safeParse(true).success).toBe(false);
  });

  it("accepts a valid prefixed UUID", () => {
    const schema = brandedIdQueryParam("sys_");
    expect(schema.safeParse("sys_550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects an invalid UUID part", () => {
    const schema = brandedIdQueryParam("sys_");
    expect(schema.safeParse("sys_not-a-uuid").success).toBe(false);
  });
});
