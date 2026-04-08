import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapGroup } from "../../mappers/group.mapper.js";

import type { SPGroup } from "../../sources/sp-types.js";

describe("mapGroup", () => {
  it("maps a minimal group with resolved members", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    ctx.register("member", "src_m2", "ps_m2");
    const sp: SPGroup = {
      _id: "g1",
      name: "Alpha Group",
      members: ["src_m1", "src_m2"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.name).toBe("Alpha Group");
      expect(result.payload.description).toBeNull();
      expect(result.payload.color).toBeNull();
      expect(result.payload.memberIds).toEqual(["ps_m1", "ps_m2"]);
    }
  });

  it("preserves desc and color", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPGroup = {
      _id: "g2",
      name: "Beta",
      desc: "the second group",
      color: "#112233",
      members: [],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.description).toBe("the second group");
      expect(result.payload.color).toBe("#112233");
      expect(result.payload.memberIds).toEqual([]);
    }
  });

  it("skips unresolvable members with a warning and keeps resolved ones", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPGroup = {
      _id: "g3",
      name: "Partial",
      members: ["src_m1", "src_missing", "src_also_missing"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberIds).toEqual(["ps_m1"]);
    }
    expect(ctx.warnings).toHaveLength(2);
    expect(ctx.warnings.every((w) => w.entityType === "group")).toBe(true);
  });

  it("emits an aggregate warning when every member is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPGroup = {
      _id: "g4",
      name: "Orphaned",
      members: ["src_x", "src_y"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberIds).toEqual([]);
    }
    // 2 per-miss warnings + 1 aggregate
    expect(ctx.warnings.length).toBeGreaterThanOrEqual(3);
    expect(ctx.warnings.some((w) => w.message.includes("all members unresolved"))).toBe(true);
  });

  it("skips when name is empty and emits a warning", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPGroup = { _id: "g5", name: "", members: [] };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("group");
    expect(ctx.warnings[0]?.entityId).toBe("g5");
  });
});
