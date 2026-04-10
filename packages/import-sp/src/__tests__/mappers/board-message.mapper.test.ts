import { describe, expect, it } from "vitest";

import { mapBoardMessage } from "../../mappers/board-message.mapper.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SPBoardMessage } from "../../sources/sp-types.js";

describe("mapBoardMessage", () => {
  it("maps a minimal board message with resolved writer", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm1",
      title: "Announcement",
      message: "hello everyone",
      writer: "src_m1",
      writtenAt: 1_234,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.title).toBe("Announcement");
      expect(result.payload.body).toBe("hello everyone");
      expect(result.payload.authorMemberId).toBe("ps_m1");
      expect(result.payload.createdAt).toBe(1_234);
    }
  });

  it("fails when writer FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPBoardMessage = {
      _id: "bm2",
      title: "x",
      message: "y",
      writer: "src_missing",
      writtenAt: 0,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("FK miss");
      expect(result.message).toContain("member");
    }
  });

  it("preserves title and body exactly", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm3",
      title: "Specific Title!",
      message: "multi\nline\nbody",
      writer: "src_m1",
      writtenAt: 42,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.title).toBe("Specific Title!");
      expect(result.payload.body).toBe("multi\nline\nbody");
      expect(result.payload.createdAt).toBe(42);
    }
  });

  it("emits a warning when readBy is present (dropped field)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm4",
      title: "x",
      message: "y",
      writer: "src_m1",
      writtenAt: 0,
      readBy: ["src_a", "src_b"],
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("board-message");
    expect(ctx.warnings[0]?.message).toContain("readBy");
  });

  it("emits the readBy-dropped warning at most once per import", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const first: SPBoardMessage = {
      _id: "bm6",
      title: "x",
      message: "y",
      writer: "src_m1",
      writtenAt: 0,
      readBy: ["src_a"],
    };
    const second: SPBoardMessage = {
      _id: "bm7",
      title: "x2",
      message: "y2",
      writer: "src_m1",
      writtenAt: 1,
      readBy: ["src_b", "src_c"],
    };
    mapBoardMessage(first, ctx);
    mapBoardMessage(second, ctx);
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.message).toContain("readBy");
  });

  it("does not warn when readBy is absent", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm5",
      title: "x",
      message: "y",
      writer: "src_m1",
      writtenAt: 0,
    };
    mapBoardMessage(sp, ctx);
    expect(ctx.warnings).toHaveLength(0);
  });
});
