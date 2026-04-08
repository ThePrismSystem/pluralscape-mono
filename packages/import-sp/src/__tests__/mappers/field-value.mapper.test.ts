import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { extractFieldValues } from "../../mappers/field-value.mapper.js";

describe("extractFieldValues", () => {
  it("returns one entry per (memberSourceId, fieldSourceId, value) triple", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = extractFieldValues(
      { memberSourceId: "m1", info: { fld_1: "blue", fld_2: "42" } },
      ctx,
    );
    expect(result).toHaveLength(2);
    expect(result.find((v) => v.fieldSourceId === "fld_1")?.value).toBe("blue");
    expect(result.find((v) => v.fieldSourceId === "fld_2")?.value).toBe("42");
    expect(result.every((v) => v.memberSourceId === "m1")).toBe(true);
  });

  it("returns an empty array when info is undefined", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    expect(extractFieldValues({ memberSourceId: "m1", info: undefined }, ctx)).toEqual([]);
    expect(ctx.warnings).toHaveLength(0);
  });

  it("emits a warning and skips empty value strings", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = extractFieldValues({ memberSourceId: "m1", info: { fld_1: "" } }, ctx);
    expect(result).toHaveLength(0);
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("field-value");
    expect(ctx.warnings[0]?.entityId).toBe("m1/fld_1");
  });
});
