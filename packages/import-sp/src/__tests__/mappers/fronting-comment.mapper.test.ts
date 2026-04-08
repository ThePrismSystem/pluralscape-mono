import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFrontingComment } from "../../mappers/fronting-comment.mapper.js";

import type { SPComment } from "../../sources/sp-types.js";

describe("mapFrontingComment", () => {
  it("maps a comment with resolved fronting session FK", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("fronting-session", "src_fh1", "ps_fh1");
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
      expect(result.payload.body).toBe("hello");
      expect(result.payload.createdAt).toBe(12_345);
    }
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
    ctx.register("fronting-session", "src_fh1", "ps_fh1");
    const sp: SPComment = {
      _id: "c3",
      documentId: "src_fh1",
      text: "",
      time: 0,
    };
    const result = mapFrontingComment(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.body).toBe("");
    }
  });

  it("preserves the time field precisely", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("fronting-session", "src_fh1", "ps_fh1");
    const sp: SPComment = {
      _id: "c4",
      documentId: "src_fh1",
      text: "later",
      time: 1_700_000_000_000,
    };
    const result = mapFrontingComment(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.createdAt).toBe(1_700_000_000_000);
    }
  });
});
