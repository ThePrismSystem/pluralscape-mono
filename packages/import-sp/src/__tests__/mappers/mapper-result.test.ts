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

  it("skipped carries a reason", () => {
    const result = skipped("not in scope");
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("not in scope");
    }
  });

  it("failed carries a message", () => {
    const result = failed("validation: missing FK");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toBe("validation: missing FK");
    }
  });
});
