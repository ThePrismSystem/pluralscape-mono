import { describe, expect, it } from "vitest";

import { createMappingContext, type MappingContext } from "../../mappers/context.js";
import { mapMember } from "../../mappers/member.mapper.js";

import type { SPMember } from "../../sources/sp-types.js";

/**
 * Build a mapping context with all three synthetic privacy buckets
 * pre-registered in the translation table. Used by every test that exercises
 * the legacy privacy flags so the member mapper can resolve the synthetic
 * source IDs through `ctx.translate(...)` without hitting the fail-closed
 * `fk-miss` path.
 */
function createCtxWithSyntheticBuckets(): MappingContext {
  const ctx = createMappingContext({ sourceMode: "fake" });
  ctx.register("privacy-bucket", "synthetic:public", "ps_bucket_public");
  ctx.register("privacy-bucket", "synthetic:trusted", "ps_bucket_trusted");
  ctx.register("privacy-bucket", "synthetic:private", "ps_bucket_private");
  return ctx;
}

describe("mapMember", () => {
  it("maps a minimal member", () => {
    const sp: SPMember = { _id: "m1", name: "Aria" };
    const result = mapMember(sp, createCtxWithSyntheticBuckets());
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.member.name).toBe("Aria");
      expect(result.payload.member.description).toBeNull();
      expect(result.payload.member.pronouns).toBeNull();
      expect(result.payload.member.avatarUrl).toBeNull();
      expect(result.payload.member.colors).toEqual([]);
      expect(result.payload.member.archived).toBe(false);
      expect(result.payload.fieldValues).toEqual([]);
    }
  });

  it("converts the SP single color to a one-entry colors array", () => {
    const sp: SPMember = { _id: "m1", name: "A", color: "#fa0" };
    const result = mapMember(sp, createCtxWithSyntheticBuckets());
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.member.colors).toEqual(["#fa0"]);
    }
  });

  it("preserves desc, pronouns, avatarUrl, and archived", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      desc: "hi",
      pronouns: "they/them",
      avatarUrl: "https://x/y.png",
      archived: true,
    };
    const result = mapMember(sp, createCtxWithSyntheticBuckets());
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.member.description).toBe("hi");
      expect(result.payload.member.pronouns).toBe("they/them");
      expect(result.payload.member.avatarUrl).toBe("https://x/y.png");
      expect(result.payload.member.archived).toBe(true);
    }
  });

  it("extracts info into field values", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      info: { fld_1: "blue", fld_2: "42" },
    };
    const result = mapMember(sp, createCtxWithSyntheticBuckets());
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.fieldValues).toHaveLength(2);
      expect(result.payload.fieldValues[0]?.memberSourceId).toBe("m1");
    }
  });

  it("resolves modern bucket assignments through the translation table", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("privacy-bucket", "bk1", "ps_bucket_1");
    ctx.register("privacy-bucket", "bk2", "ps_bucket_2");
    const sp: SPMember = { _id: "m1", name: "A", buckets: ["bk1", "bk2"] };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_1", "ps_bucket_2"]);
    }
  });

  it("translates legacy private:true to synthetic:private and resolves it", () => {
    const ctx = createCtxWithSyntheticBuckets();
    const sp: SPMember = { _id: "m1", name: "A", private: true };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_private"]);
    }
  });

  it("translates legacy preventTrusted:true (not private) to public-only and resolves it", () => {
    const ctx = createCtxWithSyntheticBuckets();
    const sp: SPMember = { _id: "m1", name: "A", private: false, preventTrusted: true };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_public"]);
    }
  });

  it("translates legacy private:false, preventTrusted:false to public + trusted and resolves them", () => {
    const ctx = createCtxWithSyntheticBuckets();
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      private: false,
      preventTrusted: false,
    };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_public", "ps_bucket_trusted"]);
    }
  });

  it("fails closed to synthetic:private when no bucket info is available and resolves it", () => {
    const ctx = createCtxWithSyntheticBuckets();
    const sp: SPMember = { _id: "m1", name: "A" };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_private"]);
    }
  });

  it("modern buckets override legacy private/preventTrusted flags", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("privacy-bucket", "bk1", "ps_bucket_1");
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      buckets: ["bk1"],
      private: true,
      preventTrusted: true,
    };
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_1"]);
    }
  });

  it("skips members with empty names and emits a warning", () => {
    const sp: SPMember = { _id: "m1", name: "" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("member");
  });

  it("warns for dropped frame and supportDescMarkdown fields", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      frame: "vintage",
      supportDescMarkdown: true,
    };
    const ctx = createCtxWithSyntheticBuckets();
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    const messages = ctx.warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes("frame"))).toBe(true);
    expect(messages.some((m) => m.includes("supportDescMarkdown"))).toBe(true);
  });

  it("warns for dropped per-member notification toggles", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      preventsFrontNotifs: true,
      receiveMessageBoardNotifs: false,
    };
    const ctx = createCtxWithSyntheticBuckets();
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    expect(ctx.warnings.some((w) => w.message.includes("notification"))).toBe(true);
  });
});

describe("member bucket reference resolution", () => {
  it("returns failed with kind fk-miss when a bucket ref is unresolvable", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    // No bucket registered in translation table.

    const sp: SPMember = { _id: "sp_m_1", name: "Alex", buckets: ["sp_bucket_unknown"] };
    const result = mapMember(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toContain("sp_bucket_unknown");
      expect(result.targetField).toBe("buckets");
    }
  });

  it("returns mapped with resolved bucket IDs when all buckets are registered", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("privacy-bucket", "synthetic:private", "ps_bucket_private");

    const sp: SPMember = { _id: "sp_m_1", name: "Alex", private: true };
    const result = mapMember(sp, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual(["ps_bucket_private"]);
    }
  });

  it("surfaces every missing ref in missingRefs when multiple buckets are unresolvable", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("privacy-bucket", "bk_known", "ps_bucket_known");

    const sp: SPMember = {
      _id: "sp_m_1",
      name: "Alex",
      buckets: ["bk_known", "bk_miss_1", "bk_miss_2"],
    };
    const result = mapMember(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toEqual(["bk_miss_1", "bk_miss_2"]);
      expect(result.targetField).toBe("buckets");
    }
  });
});
