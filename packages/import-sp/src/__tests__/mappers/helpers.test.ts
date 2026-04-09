import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { warnUnknownKeys } from "../../mappers/helpers.js";

describe("warnUnknownKeys", () => {
  it("emits a warning per unknown key once", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const known = new Set(["name", "description"]);
    const payload = { name: "Alex", description: "hi", extraField: 1, anotherField: 2 };

    warnUnknownKeys(ctx, "member", known, payload);

    expect(ctx.warnings).toHaveLength(2);
    expect(ctx.warnings.map((w) => w.key)).toEqual(
      expect.arrayContaining(["unknown-field:extraField", "unknown-field:anotherField"]),
    );
  });

  it("deduplicates across multiple calls with the same key", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const known = new Set(["name"]);
    warnUnknownKeys(ctx, "member", known, { name: "A", extra: 1 });
    warnUnknownKeys(ctx, "member", known, { name: "B", extra: 2 });

    expect(ctx.warnings.filter((w) => w.key === "unknown-field:extra")).toHaveLength(1);
  });
});
