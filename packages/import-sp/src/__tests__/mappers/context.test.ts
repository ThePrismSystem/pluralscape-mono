import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";

const WARNING_OVERFLOW_COUNT = 1_500;
const WARNING_CAP = 1_000;

describe("MappingContext", () => {
  it("starts with an empty translation table and no warnings", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    expect(ctx.warnings.length).toBe(0);
    expect(ctx.translate("member", "missing")).toBeNull();
  });

  it("translate returns the registered Pluralscape ID", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_1", "mem_target_1");
    expect(ctx.translate("member", "src_1")).toBe("mem_target_1");
  });

  it("translate is per-entity-type — same sourceId across types is independent", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "x", "mem_x");
    ctx.register("group", "x", "grp_x");
    expect(ctx.translate("member", "x")).toBe("mem_x");
    expect(ctx.translate("group", "x")).toBe("grp_x");
  });

  it("registerMany batch-loads entries", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.registerMany("member", [
      { sourceId: "a", pluralscapeId: "mem_a" },
      { sourceId: "b", pluralscapeId: "mem_b" },
    ]);
    expect(ctx.translate("member", "a")).toBe("mem_a");
    expect(ctx.translate("member", "b")).toBe("mem_b");
  });

  it("addWarning records into the warnings buffer", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.addWarning({ entityType: "member", entityId: "x", message: "color invalid" });
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.message).toBe("color invalid");
  });

  it("addWarning caps the buffer at MAX_WARNING_BUFFER_SIZE", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    for (let i = 0; i < WARNING_OVERFLOW_COUNT; i++) {
      ctx.addWarning({ entityType: "member", entityId: String(i), message: "x" });
    }
    expect(ctx.warnings.length).toBeLessThanOrEqual(WARNING_CAP);
  });
});
