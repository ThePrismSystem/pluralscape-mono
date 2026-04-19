import { describe, expect, it } from "vitest";

import { ContextFileSchema, CONTEXT_NAMESPACES } from "../../crowdin/context-schema.js";

describe("ContextFileSchema", () => {
  it("accepts a valid context map", () => {
    const parsed = ContextFileSchema.parse({ ok: "Affirmation button" });
    expect(parsed).toEqual({ ok: "Affirmation button" });
  });

  it("accepts an empty object", () => {
    expect(ContextFileSchema.parse({})).toEqual({});
  });

  it("rejects blank keys", () => {
    expect(() => ContextFileSchema.parse({ "": "text" })).toThrow();
  });

  it("rejects blank values", () => {
    expect(() => ContextFileSchema.parse({ key: "" })).toThrow();
  });

  it("rejects non-string values", () => {
    expect(() => ContextFileSchema.parse({ key: 123 })).toThrow();
  });
});

describe("CONTEXT_NAMESPACES", () => {
  it("lists only namespaces whose sidecar file exists on disk", () => {
    expect([...CONTEXT_NAMESPACES]).toEqual(["common"]);
  });
});
