import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFrontingComment } from "../../mappers/fronting-comment.mapper.js";

import type { SPComment } from "../../sources/sp-types.js";

/** Register a fronting session and store its subject metadata, mirroring what the session mapper does. */
function registerSessionWithSubject(
  ctx: ReturnType<typeof createMappingContext>,
  sourceId: string,
  pluralscapeId: string,
  subject: { memberId?: string; customFrontId?: string },
): void {
  ctx.register("fronting-session", sourceId, pluralscapeId);
  ctx.storeMetadata("fronting-session", sourceId, "memberId", subject.memberId);
  ctx.storeMetadata("fronting-session", sourceId, "customFrontId", subject.customFrontId);
}

describe("mapFrontingComment", () => {
  it("maps a comment with resolved fronting session FK and member subject", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    registerSessionWithSubject(ctx, "src_fh1", "ps_fh1", { memberId: "mem_abc" });
    const sp: SPComment = {
      _id: "c1",
      documentId: "src_fh1",
      text: "hello",
      time: 12_345,
    };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.frontingSessionId).toBe("ps_fh1");
      expect(result.payload.encrypted.content).toBe("hello");
      expect(result.payload.createdAt).toBe(12_345);
      expect(result.payload.memberId).toBe("mem_abc");
      expect(result.payload.customFrontId).toBeUndefined();
      expect(result.payload.structureEntityId).toBeUndefined();
    }
  });

  it("inherits member subject from the parent fronting session", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    registerSessionWithSubject(ctx, "fh_member", "ps_fh_member", { memberId: "mem_123" });
    const sp: SPComment = { _id: "c_m", documentId: "fh_member", text: "test", time: 100 };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberId).toBe("mem_123");
      expect(result.payload.customFrontId).toBeUndefined();
    }
  });

  it("inherits custom front subject from the parent fronting session", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    registerSessionWithSubject(ctx, "fh_cf", "ps_fh_cf", { customFrontId: "cf_456" });
    const sp: SPComment = { _id: "c_cf", documentId: "fh_cf", text: "test", time: 200 };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberId).toBeUndefined();
      expect(result.payload.customFrontId).toBe("cf_456");
    }
  });

  it("emits a warning when session has no subject metadata", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    // Register the session FK but store no subject metadata
    ctx.register("fronting-session", "src_fh_no_subject", "ps_fh_no_subject");
    const sp: SPComment = { _id: "c_warn", documentId: "src_fh_no_subject", text: "x", time: 1 };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.message).toContain("No subject metadata");
  });

  it("fails when the fronting session FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPComment = {
      _id: "c2",
      documentId: "src_missing",
      text: "x",
      time: 1,
    };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("FK miss");
      expect(result.message).toContain("fronting-session");
    }
  });

  it("accepts empty text (SP allows empty comments)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    registerSessionWithSubject(ctx, "src_fh1", "ps_fh1", { memberId: "mem_abc" });
    const sp: SPComment = {
      _id: "c3",
      documentId: "src_fh1",
      text: "",
      time: 0,
    };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.content).toBe("");
    }
  });

  it("preserves the time field precisely", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    registerSessionWithSubject(ctx, "src_fh1", "ps_fh1", { memberId: "mem_abc" });
    const sp: SPComment = {
      _id: "c4",
      documentId: "src_fh1",
      text: "later",
      time: 1_700_000_000_000,
    };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.createdAt).toBe(1_700_000_000_000);
    }
  });
});
