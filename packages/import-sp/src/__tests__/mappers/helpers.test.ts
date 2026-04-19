import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { summarizeMissingRefs, warnUnknownKeys } from "../../mappers/helpers.js";

describe("warnUnknownKeys", () => {
  it("emits a warning per unknown key once", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const known = new Set(["name", "description"]);
    const payload = { name: "Alex", description: "hi", extraField: 1, anotherField: 2 };

    warnUnknownKeys(ctx, "member", known, payload);

    expect(ctx.warnings).toHaveLength(2);
    expect(ctx.warnings.map((w) => w.key)).toEqual(
      expect.arrayContaining([
        "unknown-field:member:extraField",
        "unknown-field:member:anotherField",
      ]),
    );
  });

  it("deduplicates across multiple calls with the same entityType+key", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const known = new Set(["name"]);
    warnUnknownKeys(ctx, "member", known, { name: "A", extra: 1 });
    warnUnknownKeys(ctx, "member", known, { name: "B", extra: 2 });

    expect(ctx.warnings.filter((w) => w.key === "unknown-field:member:extra")).toHaveLength(1);
  });

  it("does NOT dedupe the same unknown key across different entity types", () => {
    // Pre-fix, the dedup key was `unknown-field:${key}` globally, so a
    // custom-front with an unknown `frame` field would silently suppress
    // the member's identical `frame` warning. Scoping the key by
    // entityType fixes that.
    const ctx = createMappingContext({ sourceMode: "file" });
    const known = new Set(["name"]);
    warnUnknownKeys(ctx, "member", known, { name: "A", sharedKey: 1 });
    warnUnknownKeys(ctx, "custom-front", known, { name: "B", sharedKey: 2 });

    expect(ctx.warnings.filter((w) => w.key?.endsWith(":sharedKey"))).toHaveLength(2);
    expect(ctx.warnings.some((w) => w.key === "unknown-field:member:sharedKey")).toBe(true);
    expect(ctx.warnings.some((w) => w.key === "unknown-field:custom-front:sharedKey")).toBe(true);
  });
});

describe("summarizeMissingRefs", () => {
  it("returns all refs joined when under the limit", () => {
    expect(summarizeMissingRefs(["a", "b", "c"])).toBe("a, b, c");
  });

  it("shows the first five and summarises the remainder", () => {
    const refs = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(summarizeMissingRefs(refs)).toBe("a, b, c, d, e, and 3 more");
  });

  it("handles exactly-at-limit without an 'and more' suffix", () => {
    expect(summarizeMissingRefs(["1", "2", "3", "4", "5"])).toBe("1, 2, 3, 4, 5");
  });
});
