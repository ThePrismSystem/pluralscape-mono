import { describe, expect, it } from "vitest";

import {
  classifyError,
  isFatalError,
  ResumeCutoffNotFoundError,
} from "../../engine/engine-errors.js";
import {
  ApiSourcePermanentError,
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
} from "../../sources/api-source.js";

describe("classifyError", () => {
  it("classifies token rejection as fatal + recoverable", () => {
    const error = classifyError(new ApiSourceTokenRejectedError(), {
      entityType: "member",
      entityId: null,
    });
    if (!error.fatal) throw new Error("expected fatal error");
    expect(error.recoverable).toBe(true);
    expect(error.entityType).toBe("unknown");
  });

  it("classifies transient API error as fatal + recoverable", () => {
    const error = classifyError(new ApiSourceTransientError("rate limit exhausted"), {
      entityType: "member",
      entityId: null,
    });
    if (!error.fatal) throw new Error("expected fatal error");
    expect(error.recoverable).toBe(true);
  });

  it("classifies generic Error inside a per-entity context as non-fatal", () => {
    const error = classifyError(new Error("validation failed"), {
      entityType: "member",
      entityId: "src_1",
    });
    expect(error.fatal).toBe(false);
    expect(error.entityType).toBe("member");
    expect(error.entityId).toBe("src_1");
  });

  it("classifies ResumeCutoffNotFoundError as fatal + recoverable with cutoff id", () => {
    const thrown = new ResumeCutoffNotFoundError("members", "m_missing");
    const error = classifyError(thrown, { entityType: "member", entityId: "m_missing" });
    if (!error.fatal) throw new Error("expected fatal error");
    expect(error.recoverable).toBe(true);
    expect(error.entityType).toBe("unknown");
    expect(error.entityId).toBe("m_missing");
    expect(error.message).toContain("resume cutoff not found in members");
    expect(error.message).toContain("m_missing");
  });

  it("classifies a SyntaxError (JSON parse) as fatal + non-recoverable", () => {
    const error = classifyError(new SyntaxError("Unexpected token"), {
      entityType: "member",
      entityId: null,
    });
    if (!error.fatal) throw new Error("expected fatal error");
    expect(error.recoverable).toBe(false);
  });

  it("isFatalError returns true for fatal errors", () => {
    const error = classifyError(new ApiSourceTokenRejectedError(), {
      entityType: "member",
      entityId: null,
    });
    expect(isFatalError(error)).toBe(true);
  });

  it("classifies non-Error thrown values (string, number) as non-fatal with stringified message", () => {
    const result1 = classifyError("plain string", { entityType: "member", entityId: "src_1" });
    expect(result1.message).toBe("plain string");
    expect(result1.fatal).toBe(false);
    expect(result1.entityType).toBe("member");
    expect(result1.entityId).toBe("src_1");

    const result2 = classifyError(42, { entityType: "member", entityId: "src_2" });
    expect(result2.message).toBe("42");
    expect(result2.fatal).toBe(false);
    expect(result2.entityType).toBe("member");
    expect(result2.entityId).toBe("src_2");
  });
});

describe("classifyError — API source split", () => {
  it("classifies ApiSourcePermanentError as non-recoverable fatal", () => {
    const err = classifyError(new ApiSourcePermanentError("bad shape"), {
      entityType: "member",
      entityId: null,
    });
    expect(err.fatal).toBe(true);
    if (err.fatal) expect(err.recoverable).toBe(false);
  });

  it("classifies ApiSourceTransientError as recoverable fatal", () => {
    const err = classifyError(new ApiSourceTransientError("429"), {
      entityType: "member",
      entityId: null,
    });
    expect(err.fatal).toBe(true);
    if (err.fatal) expect(err.recoverable).toBe(true);
  });
});
