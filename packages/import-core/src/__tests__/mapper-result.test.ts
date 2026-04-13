import { describe, expect, it } from "vitest";

import { failed, mapped, skipped } from "../mapper-result.js";

describe("mapped()", () => {
  it("returns a mapped result with the given payload", () => {
    const result = mapped({ name: "Aria" });
    expect(result).toStrictEqual({ status: "mapped", payload: { name: "Aria" } });
  });

  it("preserves primitive payloads", () => {
    const result = mapped(42);
    expect(result.status).toBe("mapped");
    expect(result).toHaveProperty("payload", 42);
  });

  it("preserves null payload", () => {
    const result = mapped(null);
    expect(result.status).toBe("mapped");
    expect(result).toHaveProperty("payload", null);
  });
});

describe("skipped()", () => {
  it("returns a skipped result with kind and reason", () => {
    const result = skipped({ kind: "empty-name", reason: "name was blank" });
    expect(result).toStrictEqual({
      status: "skipped",
      kind: "empty-name",
      reason: "name was blank",
    });
  });
});

describe("failed()", () => {
  it("returns a failed result with required fields", () => {
    const result = failed({ kind: "fk-miss", message: "member not found" });
    expect(result).toStrictEqual({
      status: "failed",
      kind: "fk-miss",
      message: "member not found",
      missingRefs: undefined,
      targetField: undefined,
    });
  });

  it("includes optional missingRefs and targetField", () => {
    const result = failed({
      kind: "fk-miss",
      message: "missing refs",
      missingRefs: ["r1", "r2"],
      targetField: "groupId",
    });
    expect(result.status).toBe("failed");
    expect(result).toHaveProperty("missingRefs", ["r1", "r2"]);
    expect(result).toHaveProperty("targetField", "groupId");
  });
});
