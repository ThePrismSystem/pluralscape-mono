import { describe, expect, it } from "vitest";

import { mapChannel, mapChannelCategory } from "../../mappers/channel.mapper.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SPChannel, SPChannelCategory } from "../../sources/sp-types.js";

describe("mapChannelCategory", () => {
  it("maps a minimal channel category", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannelCategory = { _id: "cat1", name: "General" };
    const result = mapChannelCategory(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.name).toBe("General");
      expect(result.payload.type).toBe("category");
      expect(result.payload.parentId).toBeUndefined();
      expect(result.payload.sortOrder).toBe(0);
    }
  });

  it("preserves order on categories", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannelCategory = {
      _id: "cat2",
      name: "Art",
      desc: "creative stuff",
      order: 3,
    };
    const result = mapChannelCategory(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(3);
    }
  });

  it("skips when category name is empty and emits a warning", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannelCategory = { _id: "cat3", name: "" };
    const result = mapChannelCategory(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("channel-category");
  });
});

describe("mapChannel", () => {
  it("maps a channel with resolved parent category", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("channel-category", "src_cat1", "ps_cat1");
    const sp: SPChannel = {
      _id: "ch1",
      name: "random",
      parentCategory: "src_cat1",
    };
    const result = mapChannel(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.type).toBe("channel");
      expect(result.payload.parentId).toBe("ps_cat1");
    }
  });

  it("maps a channel with null parentCategory without warning", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannel = { _id: "ch2", name: "orphan", parentCategory: null };
    const result = mapChannel(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.parentId).toBeUndefined();
    }
    expect(ctx.warnings).toHaveLength(0);
  });

  it("returns failed with kind fk-miss when parent category cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannel = {
      _id: "ch3",
      name: "orphan2",
      parentCategory: "src_missing",
    };
    const result = mapChannel(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("parentId");
      expect(result.missingRefs).toContain("src_missing");
    }
  });

  it("preserves order on channels", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPChannel = {
      _id: "ch4",
      name: "voice",
      desc: "voice chat",
      parentCategory: null,
      order: 7,
    };
    const result = mapChannel(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(7);
    }
  });
});
