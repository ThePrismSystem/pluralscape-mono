import { describe, expect, it } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { parseIdParam } from "../../lib/id-param.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("parseIdParam", () => {
  it("returns the raw string for a valid prefix + UUID v4", () => {
    const id = `sys_${VALID_UUID}`;
    expect(parseIdParam<"SystemId">(id, "sys_")).toBe(id);
  });

  it("works with multi-character prefixes", () => {
    const id = `acct_${VALID_UUID}`;
    expect(parseIdParam<"AccountId">(id, "acct_")).toBe(id);
  });

  it("throws 400 for wrong prefix", () => {
    const id = `mem_${VALID_UUID}`;
    expect(() => parseIdParam<"SystemId">(id, "sys_")).toThrow(ApiHttpError);
    try {
      parseIdParam<"SystemId">(id, "sys_");
    } catch (error) {
      const err = error as ApiHttpError;
      expect(err.status).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws 400 for invalid UUID portion", () => {
    expect(() => parseIdParam<"SystemId">("sys_not-a-uuid", "sys_")).toThrow(ApiHttpError);
  });

  it("throws 400 for empty string", () => {
    expect(() => parseIdParam<"SystemId">("", "sys_")).toThrow(ApiHttpError);
  });

  it("throws 400 for prefix-only (no UUID)", () => {
    expect(() => parseIdParam<"SystemId">("sys_", "sys_")).toThrow(ApiHttpError);
  });

  it("rejects uppercase UUID hex", () => {
    const id = `sys_550E8400-E29B-41D4-A716-446655440000`;
    expect(() => parseIdParam<"SystemId">(id, "sys_")).toThrow(ApiHttpError);
  });

  it("rejects non-v4 UUID (version digit != 4)", () => {
    const id = `sys_550e8400-e29b-31d4-a716-446655440000`;
    expect(() => parseIdParam<"SystemId">(id, "sys_")).toThrow(ApiHttpError);
  });
});
