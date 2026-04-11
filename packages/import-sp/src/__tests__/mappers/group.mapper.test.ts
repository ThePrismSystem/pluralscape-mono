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

  it("returns failed when any member reference cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPGroup = {
      _id: "g3",
      name: "Partial",
      members: ["src_m1", "src_missing", "src_also_missing"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("members");
      expect(result.missingRefs).toContain("src_missing");
      expect(result.missingRefs).toContain("src_also_missing");
    }
  });

  it("returns failed when every member is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPGroup = {
      _id: "g4",
      name: "Orphaned",
      members: ["src_x", "src_y"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toContain("src_x");
      expect(result.missingRefs).toContain("src_y");
    }
  });

  it("keeps group names out of error messages (plaintext leak guard)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPGroup = {
      _id: "g5",
      name: "Extremely Private Group Name",
      members: ["src_missing"],
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).not.toContain("Extremely Private Group Name");
      expect(result.message).toContain("g5");
    }
  });

  it("truncates long missing-ref lists in the error message", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const manyRefs = Array.from({ length: 20 }, (_, i) => `src_missing_${String(i)}`);
    const sp: SPGroup = {
      _id: "g6",
      name: "Huge",
      members: manyRefs,
    };
    const result = mapGroup(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("and 15 more");
      // Structured field still carries every missing ref.
      expect(result.missingRefs).toHaveLength(20);
    }
  });
});

describe("group FK-miss handling", () => {
  it("returns failed when a member reference cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "sp_m_known", "ps_m_real");

    const result = mapGroup(
      {
        _id: "sp_g_1",
        name: "close friends",
        members: ["sp_m_known", "sp_m_missing"],
      },
      ctx,
    );

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toContain("sp_m_missing");
      expect(result.targetField).toBe("members");
    }
  });

  it("returns mapped when all member refs resolve", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "sp_m_1", "ps_m_real_1");
    ctx.register("member", "sp_m_2", "ps_m_real_2");

    const result = mapGroup(
      {
        _id: "sp_g_1",
        name: "close friends",
        members: ["sp_m_1", "sp_m_2"],
      },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });
});
