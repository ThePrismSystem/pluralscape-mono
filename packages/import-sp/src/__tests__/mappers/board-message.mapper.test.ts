import { describe, expect, it } from "vitest";

import { mapBoardMessage } from "../../mappers/board-message.mapper.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SPBoardMessage } from "../../sources/sp-types.js";

describe("mapBoardMessage", () => {
  it("maps a minimal board message with resolved writtenBy", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm1",
      title: "Announcement",
      message: "hello everyone",
      writtenBy: "src_m1",
      writtenAt: 1_234,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.content).toBe("# Announcement\n\nhello everyone");
      expect(result.payload.encrypted.senderId).toBe("ps_m1");
      expect(result.payload.createdAt).toBe(1_234);
      expect(result.payload.sortOrder).toBe(0);
      expect(result.payload.pinned).toBe(false);
    }
  });

  it("fails when writtenBy FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPBoardMessage = {
      _id: "bm2",
      title: "x",
      message: "y",
      writtenBy: "src_missing",
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
      writtenBy: "src_m1",
      writtenAt: 42,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.content).toBe("# Specific Title!\n\nmulti\nline\nbody");
      expect(result.payload.encrypted.senderId).toBe("ps_m1");
      expect(result.payload.createdAt).toBe(42);
    }
  });

  it("emits a warning when writtenFor is present (dropped field)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm4",
      title: "x",
      message: "y",
      writtenBy: "src_m1",
      writtenFor: "src_recipient",
      writtenAt: 0,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    const writtenForWarning = ctx.warnings.find((w) => w.message.includes("writtenFor"));
    expect(writtenForWarning?.entityType).toBe("board-message");
  });

  it("emits a warning when read flag is present (dropped field)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm4b",
      title: "x",
      message: "y",
      writtenBy: "src_m1",
      writtenAt: 0,
      read: true,
    };
    const result = mapBoardMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    const readWarning = ctx.warnings.find((w) => w.message.includes("read"));
    expect(readWarning?.entityType).toBe("board-message");
  });

  it("emits the writtenFor-dropped warning at most once per import", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const first: SPBoardMessage = {
      _id: "bm6",
      title: "x",
      message: "y",
      writtenBy: "src_m1",
      writtenFor: "src_a",
      writtenAt: 0,
    };
    const second: SPBoardMessage = {
      _id: "bm7",
      title: "x2",
      message: "y2",
      writtenBy: "src_m1",
      writtenFor: "src_b",
      writtenAt: 1,
    };
    mapBoardMessage(first, ctx);
    mapBoardMessage(second, ctx);
    const matches = ctx.warnings.filter((w) => w.message.includes("writtenFor"));
    expect(matches).toHaveLength(1);
  });

  it("does not warn when writtenFor and read are absent", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPBoardMessage = {
      _id: "bm5",
      title: "x",
      message: "y",
      writtenBy: "src_m1",
      writtenAt: 0,
    };
    mapBoardMessage(sp, ctx);
    expect(ctx.warnings).toHaveLength(0);
  });
});
