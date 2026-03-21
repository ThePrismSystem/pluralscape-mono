import { describe, expect, it } from "vitest";

import { brandedSetHas, formatError, makeSyncError } from "../../ws/ws.utils.js";
import { asSyncDocId } from "../helpers/crypto-test-fixtures.js";

describe("formatError", () => {
  it("returns stack trace from Error instances when available", () => {
    const err = new Error("oops");
    const result = formatError(err);
    expect(result).toContain("oops");
    expect(result).toContain("Error:");
  });

  it("returns message when stack is undefined", () => {
    const err = new Error("no-stack");
    err.stack = undefined;
    expect(formatError(err)).toBe("no-stack");
  });

  it("returns string representation of non-Error values", () => {
    expect(formatError("boom")).toBe("boom");
    expect(formatError(42)).toBe("42");
    expect(formatError(null)).toBe("null");
    expect(formatError(undefined)).toBe("undefined");
  });
});

describe("brandedSetHas", () => {
  it("returns true when value is in the set", () => {
    type Brand = "alpha" | "beta";
    const set: ReadonlySet<Brand> = new Set<Brand>(["alpha", "beta"]);
    expect(brandedSetHas(set, "alpha")).toBe(true);
  });

  it("returns false when value is not in the set", () => {
    type Brand = "alpha" | "beta";
    const set: ReadonlySet<Brand> = new Set<Brand>(["alpha", "beta"]);
    expect(brandedSetHas(set, "gamma")).toBe(false);
  });
});

describe("makeSyncError", () => {
  it("creates a SyncError with all fields", () => {
    const err = makeSyncError("PERMISSION_DENIED", "Access denied", "corr-1", asSyncDocId("doc-1"));
    expect(err).toEqual({
      type: "SyncError",
      correlationId: "corr-1",
      code: "PERMISSION_DENIED",
      message: "Access denied",
      docId: "doc-1",
    });
  });

  it("defaults docId to null", () => {
    const err = makeSyncError("AUTH_FAILED", "Bad token", null);
    expect(err.docId).toBeNull();
  });
});
