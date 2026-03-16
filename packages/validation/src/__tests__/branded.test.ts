import { describe, expect, it } from "vitest";

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
});

describe("brandedNumber", () => {
  it("accepts a number", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse(42);
    expect(result.success).toBe(true);
  });

  it("rejects a non-number value", () => {
    const schema = brandedNumber<"Score">();
    const result = schema.safeParse("not-a-number");
    expect(result.success).toBe(false);
  });
});
