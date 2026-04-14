import { describe, expect, it } from "vitest";

import { EntityChangeEventSchema } from "../../lib/entity-pubsub.js";

describe("EntityChangeEventSchema", () => {
  it("accepts a valid message event", () => {
    const result = EntityChangeEventSchema.parse({
      entity: "message",
      type: "created",
      messageId: "msg_123",
      channelId: "ch_456",
    });
    expect(result.entity).toBe("message");
  });

  it("accepts a valid boardMessage entity event", () => {
    const result = EntityChangeEventSchema.parse({
      entity: "boardMessage",
      type: "created",
      boardMessageId: "bm_123",
    });
    expect(result.entity).toBe("boardMessage");
  });

  it("accepts a valid boardMessage reorder event", () => {
    const result = EntityChangeEventSchema.parse({
      entity: "boardMessage",
      type: "reordered",
    });
    expect(result.entity).toBe("boardMessage");
  });

  it("accepts a valid poll event", () => {
    const result = EntityChangeEventSchema.parse({
      entity: "poll",
      type: "voteCast",
      pollId: "poll_123",
    });
    expect(result.entity).toBe("poll");
  });

  it("accepts a valid acknowledgement event", () => {
    const result = EntityChangeEventSchema.parse({
      entity: "acknowledgement",
      type: "confirmed",
      ackId: "ack_123",
    });
    expect(result.entity).toBe("acknowledgement");
  });

  it("rejects an unknown entity type", () => {
    expect(() => EntityChangeEventSchema.parse({ entity: "unknown", type: "created" })).toThrow();
  });

  it("rejects a boardMessage entity event without boardMessageId", () => {
    expect(() =>
      EntityChangeEventSchema.parse({ entity: "boardMessage", type: "created" }),
    ).toThrow();
  });
});
