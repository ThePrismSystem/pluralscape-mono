import { describe, expect, it } from "vitest";

import {
  CreateChannelBodySchema,
  UpdateChannelBodySchema,
  ChannelQuerySchema,
} from "../channel.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

const VALID_CHANNEL_ID = "ch_12345678-1234-1234-1234-123456789abc";

describe("CreateChannelBodySchema", () => {
  it("accepts a valid category body", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "category",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("category");
      expect(result.data.parentId).toBeUndefined();
    }
  });

  it("accepts a valid channel body with parentId", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "channel",
      parentId: VALID_CHANNEL_ID,
      sortOrder: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe(VALID_CHANNEL_ID);
    }
  });

  it("accepts a channel body without parentId", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "channel",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateChannelBodySchema.safeParse({
      type: "category",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "",
      type: "category",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      type: "category",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "thread",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sortOrder", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "category",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "category",
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "category",
      sortOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects parentId with wrong prefix", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "channel",
      parentId: "mem_12345678-1234-1234-1234-123456789abc",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects parentId with invalid UUID", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "channel",
      parentId: "ch_not-a-uuid",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      type: "category",
      sortOrder: 0,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
        type: "category",
        sortOrder: 0,
      });
    }
  });
});

describe("UpdateChannelBodySchema", () => {
  it("accepts a valid update body", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with optional sortOrder", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 2,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it("rejects version less than 1", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = UpdateChannelBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ChannelQuerySchema", () => {
  it("accepts empty query", () => {
    const result = ChannelQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts type filter", () => {
    const result = ChannelQuerySchema.safeParse({ type: "category" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("category");
    }
  });

  it("accepts channel type filter", () => {
    const result = ChannelQuerySchema.safeParse({ type: "channel" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type filter", () => {
    const result = ChannelQuerySchema.safeParse({ type: "thread" });
    expect(result.success).toBe(false);
  });

  it("accepts parentId filter", () => {
    const result = ChannelQuerySchema.safeParse({ parentId: VALID_CHANNEL_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe(VALID_CHANNEL_ID);
    }
  });

  it("accepts includeArchived filter", () => {
    const result = ChannelQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("transforms includeArchived false", () => {
    const result = ChannelQuerySchema.safeParse({ includeArchived: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });
});
