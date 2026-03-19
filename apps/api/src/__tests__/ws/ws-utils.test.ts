import { describe, expect, it } from "vitest";

import { formatError, makeSyncError } from "../../ws/ws.utils.js";

describe("formatError", () => {
  it("returns message from Error instances", () => {
    expect(formatError(new Error("oops"))).toBe("oops");
  });

  it("returns string representation of non-Error values", () => {
    expect(formatError("boom")).toBe("boom");
    expect(formatError(42)).toBe("42");
    expect(formatError(null)).toBe("null");
    expect(formatError(undefined)).toBe("undefined");
  });
});

describe("makeSyncError", () => {
  it("creates a SyncError with all fields", () => {
    const err = makeSyncError("PERMISSION_DENIED", "Access denied", "corr-1", "doc-1");
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
