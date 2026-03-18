import { describe, expect, it } from "vitest";

import { parseIdParam, requireIdParam, requireParam } from "../../lib/id-param.js";

const VALID_UUID_V4 = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_V7 = "019513a4-5e00-7b3a-8e1a-4f5c6d7e8f90";

describe("parseIdParam", () => {
  it("returns the raw string for a valid prefix + UUID v4", () => {
    const id = `sys_${VALID_UUID_V4}`;
    expect(parseIdParam(id, "sys_")).toBe(id);
  });

  it("returns the raw string for a valid prefix + UUID v7", () => {
    const id = `sys_${VALID_UUID_V7}`;
    expect(parseIdParam(id, "sys_")).toBe(id);
  });

  it("works with multi-character prefixes", () => {
    const id = `acct_${VALID_UUID_V4}`;
    expect(parseIdParam(id, "acct_")).toBe(id);
  });

  it("throws 400 for wrong prefix", () => {
    const id = `mem_${VALID_UUID_V4}`;
    expect(() => parseIdParam(id, "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for invalid UUID portion", () => {
    expect(() => parseIdParam("sys_not-a-uuid", "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for empty string", () => {
    expect(() => parseIdParam("", "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for prefix-only (no UUID)", () => {
    expect(() => parseIdParam("sys_", "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("rejects uppercase UUID hex", () => {
    const id = `sys_550E8400-E29B-41D4-A716-446655440000`;
    expect(() => parseIdParam(id, "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("accepts UUIDs with any version digit", () => {
    // Version 3
    const v3 = `sys_550e8400-e29b-31d4-a716-446655440000`;
    expect(parseIdParam(v3, "sys_")).toBe(v3);
    // Version 7
    const v7 = `sys_${VALID_UUID_V7}`;
    expect(parseIdParam(v7, "sys_")).toBe(v7);
  });
});

describe("requireParam", () => {
  it("returns the string for valid non-empty input", () => {
    expect(requireParam("hello", "name")).toBe("hello");
  });

  it("throws 400 VALIDATION_ERROR for undefined", () => {
    expect(() => requireParam(undefined, "systemId")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 VALIDATION_ERROR for empty string", () => {
    expect(() => requireParam("", "systemId")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});

describe("requireIdParam", () => {
  it("returns branded ID for valid input", () => {
    const id = `sys_${VALID_UUID_V4}`;
    expect(requireIdParam(id, "systemId", "sys_")).toBe(id);
  });

  it("throws 400 VALIDATION_ERROR for undefined", () => {
    expect(() => requireIdParam(undefined, "systemId", "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 VALIDATION_ERROR for malformed ID", () => {
    expect(() => requireIdParam("not-valid", "systemId", "sys_")).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
