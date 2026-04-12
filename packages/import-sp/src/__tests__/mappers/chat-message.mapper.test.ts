import { describe, expect, it } from "vitest";

import { mapChatMessage } from "../../mappers/chat-message.mapper.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SPChatMessage } from "../../sources/sp-types.js";

describe("mapChatMessage", () => {
  it("maps a minimal chat message with resolved FKs", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("channel", "src_ch1", "ps_ch1");
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPChatMessage = {
      _id: "cm1",
      channel: "src_ch1",
      writer: "src_m1",
      message: "hi",
      writtenAt: 1_000,
    };
    const result = mapChatMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.channelId).toBe("ps_ch1");
      expect(result.payload.encrypted.senderId).toBe("ps_m1");
      expect(result.payload.encrypted.content).toBe("hi");
      expect(result.payload.encrypted.attachments).toEqual([]);
      expect(result.payload.encrypted.mentions).toEqual([]);
      expect(result.payload.timestamp).toBe(1_000);
      expect(result.payload.replyToId).toBeUndefined();
    }
  });

  it("fails when channel FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPChatMessage = {
      _id: "cm2",
      channel: "src_missing",
      writer: "src_m1",
      message: "x",
      writtenAt: 0,
    };
    const result = mapChatMessage(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("channel");
    }
  });

  it("fails when writer FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("channel", "src_ch1", "ps_ch1");
    const sp: SPChatMessage = {
      _id: "cm3",
      channel: "src_ch1",
      writer: "src_missing",
      message: "x",
      writtenAt: 0,
    };
    const result = mapChatMessage(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("member");
    }
  });

  it("resolves replyTo through the chat-message translation table", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("channel", "src_ch1", "ps_ch1");
    ctx.register("member", "src_m1", "ps_m1");
    ctx.register("chat-message", "src_parent", "ps_parent");
    const sp: SPChatMessage = {
      _id: "cm4",
      channel: "src_ch1",
      writer: "src_m1",
      message: "reply",
      writtenAt: 1,
      replyTo: "src_parent",
    };
    const result = mapChatMessage(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.replyToId).toBe("ps_parent");
    }
  });
});

describe("chat-message FK-miss handling", () => {
  it("returns failed with kind fk-miss when replyTo cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("channel", "src_ch1", "ps_ch1");
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPChatMessage = {
      _id: "cm_missing_reply",
      channel: "src_ch1",
      writer: "src_m1",
      message: "orphan reply",
      writtenAt: 1,
      replyTo: "src_missing_parent",
    };
    const result = mapChatMessage(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toContain("src_missing_parent");
      expect(result.targetField).toBe("replyTo");
    }
  });

  it("returns failed with kind fk-miss when channel cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPChatMessage = {
      _id: "cm_missing_channel",
      channel: "src_missing_ch",
      writer: "src_m1",
      message: "hi",
      writtenAt: 1,
    };
    const result = mapChatMessage(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.missingRefs).toContain("src_missing_ch");
      expect(result.targetField).toBe("channel");
    }
  });

  it("returns mapped when replyTo is resolved in the translation table", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("channel", "src_ch1", "ps_ch1");
    ctx.register("member", "src_m1", "ps_m1");
    ctx.register("chat-message", "src_parent", "ps_parent");
    const sp: SPChatMessage = {
      _id: "cm_ok",
      channel: "src_ch1",
      writer: "src_m1",
      message: "reply",
      writtenAt: 1,
      replyTo: "src_parent",
    };
    const result = mapChatMessage(sp, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.replyToId).toBe("ps_parent");
    }
  });
});
