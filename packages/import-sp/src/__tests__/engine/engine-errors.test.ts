import { describe, expect, it } from "vitest";

import { classifyError, isFatalError } from "../../engine/engine-errors.js";
import { ApiSourceTokenRejectedError, ApiSourceTransientError } from "../../sources/api-source.js";

describe("classifyError", () => {
  it("classifies token rejection as fatal + recoverable", () => {
    const error = classifyError(new ApiSourceTokenRejectedError(), {
      entityType: "member",
      entityId: null,
    });
    expect(error.fatal).toBe(true);
    expect(error.recoverable).toBe(true);
    expect(error.entityType).toBe("unknown");
  });

  it("classifies transient API error as fatal + recoverable", () => {
    const error = classifyError(new ApiSourceTransientError("rate limit exhausted"), {
      entityType: "member",
      entityId: null,
    });
    expect(error.fatal).toBe(true);
    expect(error.recoverable).toBe(true);
  });

  it("classifies generic Error inside a per-entity context as non-fatal", () => {
    const error = classifyError(new Error("validation failed"), {
      entityType: "member",
      entityId: "src_1",
    });
    expect(error.fatal).toBe(false);
    expect(error.recoverable).toBe(false);
    expect(error.entityType).toBe("member");
    expect(error.entityId).toBe("src_1");
  });

  it("classifies a SyntaxError (JSON parse) as fatal + non-recoverable", () => {
    const error = classifyError(new SyntaxError("Unexpected token"), {
      entityType: "member",
      entityId: null,
    });
    expect(error.fatal).toBe(true);
    expect(error.recoverable).toBe(false);
  });

  it("isFatalError returns true for fatal errors", () => {
    const error = classifyError(new ApiSourceTokenRejectedError(), {
      entityType: "member",
      entityId: null,
    });
    expect(isFatalError(error)).toBe(true);
  });
});
