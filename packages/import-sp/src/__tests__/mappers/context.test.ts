import { describe, expect, it } from "vitest";

import { MAX_WARNING_BUFFER_SIZE } from "../../import-sp.constants.js";
import { createMappingContext } from "../../mappers/context.js";

const WARNING_OVERFLOW_COUNT = 1_500;
const WARNING_OVERFLOW_PAD = 100;

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
    expect(ctx.warnings.length).toBeLessThanOrEqual(MAX_WARNING_BUFFER_SIZE);
  });

  it("addWarningOnce records only the first warning for a given kind", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.addWarningOnce("dropped-x", {
      entityType: "member",
      entityId: "a",
      message: "x dropped",
    });
    ctx.addWarningOnce("dropped-x", {
      entityType: "member",
      entityId: "b",
      message: "x dropped",
    });
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityId).toBe("a");
  });

  it("addWarningOnce treats different kinds independently", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.addWarningOnce("dropped-x", { entityType: "member", entityId: "a", message: "x" });
    ctx.addWarningOnce("dropped-y", { entityType: "member", entityId: "b", message: "y" });
    expect(ctx.warnings).toHaveLength(2);
  });

  it("addWarningOnce and addWarning coexist independently", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.addWarningOnce("kind", { entityType: "member", entityId: "a", message: "once" });
    ctx.addWarning({ entityType: "member", entityId: "b", message: "per-occurrence" });
    ctx.addWarning({ entityType: "member", entityId: "c", message: "per-occurrence" });
    ctx.addWarningOnce("kind", { entityType: "member", entityId: "d", message: "once" });
    expect(ctx.warnings).toHaveLength(3);
  });
});

describe("warnings buffer truncation", () => {
  it("emits one terminal warnings-truncated marker when buffer overflows", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const overflow = MAX_WARNING_BUFFER_SIZE + WARNING_OVERFLOW_PAD;
    for (let i = 0; i < overflow; i += 1) {
      ctx.addWarning({
        entityType: "member",
        entityId: `sp_${String(i)}`,
        kind: "validation-failed",
        message: `msg ${String(i)}`,
      });
    }
    const truncated = ctx.warnings.filter((w) => w.kind === "warnings-truncated");
    expect(truncated).toHaveLength(1);
    expect(truncated[0]?.kind).toBe("warnings-truncated");
    expect(truncated[0]?.message).toMatch(/dropped/i);
    expect(ctx.warnings.length).toBeLessThanOrEqual(MAX_WARNING_BUFFER_SIZE);
  });

  it("keeps the warnings buffer bounded at MAX_WARNING_BUFFER_SIZE after overflow", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const overflow = MAX_WARNING_BUFFER_SIZE + WARNING_OVERFLOW_PAD;
    for (let i = 0; i < overflow; i += 1) {
      ctx.addWarning({ entityType: "member", entityId: `sp_${String(i)}`, message: "boom" });
    }
    expect(ctx.warnings.length).toBe(MAX_WARNING_BUFFER_SIZE);
  });

  it("does not emit a marker when warnings stay under the buffer limit", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.addWarning({
      entityType: "member",
      entityId: "sp_1",
      kind: "validation-failed",
      message: "first",
    });
    expect(ctx.warnings.some((w) => w.kind === "warnings-truncated")).toBe(false);
  });

  it("emits the marker when addWarningOnce overflows the buffer", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const overflow = MAX_WARNING_BUFFER_SIZE + WARNING_OVERFLOW_PAD;
    for (let i = 0; i < overflow; i += 1) {
      ctx.addWarningOnce(`k-${String(i)}`, {
        entityType: "member",
        entityId: `sp_${String(i)}`,
        message: "once",
      });
    }
    const truncated = ctx.warnings.filter((w) => w.kind === "warnings-truncated");
    expect(truncated).toHaveLength(1);
  });
});
