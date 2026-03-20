import { describe, expect, it } from "vitest";

import { filterFields, parseSparseFields } from "../../lib/sparse-fieldset.js";

const ALLOWED = ["id", "name", "email", "role", "createdAt"] as const;

describe("parseSparseFields", () => {
  it("returns undefined when no fields param", () => {
    expect(parseSparseFields(undefined, ALLOWED)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseSparseFields("", ALLOWED)).toBeUndefined();
  });

  it("returns undefined for whitespace-only", () => {
    expect(parseSparseFields("  ,  , ", ALLOWED)).toBeUndefined();
  });

  it("parses comma-separated field names", () => {
    const result = parseSparseFields("name,email", ALLOWED);
    expect(result).toBeDefined();
    expect(result).toContain("name");
    expect(result).toContain("email");
    expect(result).toContain("id"); // always included
  });

  it("always includes id even if not requested", () => {
    const result = parseSparseFields("name", ALLOWED);
    expect(result).toContain("id");
  });

  it("trims whitespace from field names", () => {
    const result = parseSparseFields(" name , email ", ALLOWED);
    expect(result).toContain("name");
    expect(result).toContain("email");
  });

  it("throws 400 for unknown field", () => {
    expect(() => parseSparseFields("name,unknown", ALLOWED)).toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
      }),
    );
  });

  it("includes field name in error message", () => {
    expect(() => parseSparseFields("badField", ALLOWED)).toThrow(/badField/);
  });
});

describe("filterFields", () => {
  const item: Record<string, unknown> = {
    id: "1",
    name: "Alice",
    email: "alice@test.com",
    role: "admin",
    createdAt: 100,
  };

  it("returns full object when fields is undefined", () => {
    expect(filterFields(item, undefined)).toEqual(item);
  });

  it("returns only specified fields", () => {
    const fields = new Set(["id", "name"]);
    expect(filterFields(item, fields)).toEqual({ id: "1", name: "Alice" });
  });

  it("ignores fields not present on item", () => {
    const fields = new Set(["id", "nonexistent"]);
    expect(filterFields(item, fields)).toEqual({ id: "1" });
  });
});
