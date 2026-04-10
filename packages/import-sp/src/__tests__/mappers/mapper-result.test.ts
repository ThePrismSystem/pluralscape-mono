import { describe, expect, it } from "vitest";

import { failed, mapped, skipped } from "../../mappers/mapper-result.js";

describe("MapperResult constructors", () => {
  it("mapped wraps a payload", () => {
    const result = mapped({ id: "a" });
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload).toEqual({ id: "a" });
    }
  });

  it("skipped carries a typed kind and reason", () => {
    const result = skipped({ kind: "dropped-collection", reason: "not in scope" });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.kind).toBe("dropped-collection");
      expect(result.reason).toBe("not in scope");
    }
  });

  it("failed carries a typed kind, message, missingRefs and targetField", () => {
    const result = failed({
      kind: "fk-miss",
      message: "validation: missing FK",
      missingRefs: ["src_1"],
      targetField: "writer",
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.message).toBe("validation: missing FK");
      expect(result.missingRefs).toEqual(["src_1"]);
      expect(result.targetField).toBe("writer");
    }
  });

  it("failed leaves missingRefs and targetField undefined when omitted", () => {
    const result = failed({ kind: "validation-failed", message: "boom" });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.missingRefs).toBeUndefined();
      expect(result.targetField).toBeUndefined();
    }
  });
});
