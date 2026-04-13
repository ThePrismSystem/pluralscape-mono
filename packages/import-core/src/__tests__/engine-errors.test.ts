import { describe, expect, it } from "vitest";

import { classifyErrorDefault, isFatalError, ResumeCutoffNotFoundError } from "../engine-errors.js";

import type { ClassifyContext } from "../engine-errors.js";

const CTX: ClassifyContext = { entityType: "member", entityId: "src-1" };

describe("classifyErrorDefault()", () => {
  it("classifies ResumeCutoffNotFoundError as fatal and recoverable", () => {
    const thrown = new ResumeCutoffNotFoundError("members", "cut-1");
    const error = classifyErrorDefault(thrown, CTX);

    expect(error.fatal).toBe(true);
    expect(error).toHaveProperty("recoverable", true);
    expect(error.entityType).toBe("member");
    expect(error.entityId).toBe("src-1");
    expect(error.message).toContain("cut-1");
    expect(error.message).toContain("members");
  });

  it("classifies SyntaxError as fatal and non-recoverable", () => {
    const thrown = new SyntaxError("Unexpected token");
    const error = classifyErrorDefault(thrown, CTX);

    expect(error.fatal).toBe(true);
    expect(error).toHaveProperty("recoverable", false);
    expect(error.message).toBe("Unexpected token");
  });

  it("classifies a generic Error as non-fatal", () => {
    const thrown = new Error("something went wrong");
    const error = classifyErrorDefault(thrown, CTX);

    expect(error.fatal).toBe(false);
    expect(error.message).toBe("something went wrong");
  });

  it("classifies a non-Error value (string) as non-fatal", () => {
    const error = classifyErrorDefault("oops", CTX);
    expect(error.fatal).toBe(false);
    expect(error.message).toBe("oops");
  });

  it("classifies a non-Error value (number) as non-fatal", () => {
    const error = classifyErrorDefault(42, CTX);
    expect(error.fatal).toBe(false);
    expect(error.message).toBe("42");
  });

  it("uses the entityId from context", () => {
    const ctxNull: ClassifyContext = { entityType: "group", entityId: null };
    const error = classifyErrorDefault(new Error("boom"), ctxNull);
    expect(error.entityType).toBe("group");
    expect(error.entityId).toBeNull();
  });
});

describe("ResumeCutoffNotFoundError", () => {
  it("sets name, collection, and cutoffId properties", () => {
    const err = new ResumeCutoffNotFoundError("groups", "id-42");
    expect(err.name).toBe("ResumeCutoffNotFoundError");
    expect(err.collection).toBe("groups");
    expect(err.cutoffId).toBe("id-42");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("isFatalError()", () => {
  it("returns true for a fatal error", () => {
    expect(
      isFatalError({
        entityType: "member",
        entityId: null,
        message: "bad",
        fatal: true,
        recoverable: false,
      }),
    ).toBe(true);
  });

  it("returns false for a non-fatal error", () => {
    expect(
      isFatalError({ entityType: "member", entityId: null, message: "ok", fatal: false }),
    ).toBe(false);
  });
});
