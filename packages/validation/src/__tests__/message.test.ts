import { describe, expect, it } from "vitest";

import {
  CreateMessageBodySchema,
  UpdateMessageBodySchema,
  MessageQuerySchema,
  MessageTimestampQuerySchema,
} from "../message.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

const VALID_MESSAGE_ID = "msg_12345678-1234-1234-1234-123456789abc";

describe("CreateMessageBodySchema", () => {
  it("accepts a valid body", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts body with optional replyToId", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000,
      replyToId: VALID_MESSAGE_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replyToId).toBe(VALID_MESSAGE_ID);
    }
  });

  it("rejects missing encryptedData", () => {
    const result = CreateMessageBodySchema.safeParse({
      timestamp: 1711929600000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "",
      timestamp: 1711929600000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      timestamp: 1711929600000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing timestamp", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative timestamp", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer timestamp", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects replyToId with wrong prefix", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000,
      replyToId: "ch_12345678-1234-1234-1234-123456789abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects replyToId with invalid UUID", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000,
      replyToId: "msg_not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      timestamp: 1711929600000,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
        timestamp: 1711929600000,
      });
    }
  });
});

describe("UpdateMessageBodySchema", () => {
  it("accepts a valid body", () => {
    const result = UpdateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version less than 1", () => {
    const result = UpdateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string encryptedData", () => {
    const result = UpdateMessageBodySchema.safeParse({
      encryptedData: 12345,
      version: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("MessageQuerySchema", () => {
  it("accepts empty query", () => {
    const result = MessageQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts before timestamp", () => {
    const result = MessageQuerySchema.safeParse({ before: "1711929600000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.before).toBe(1711929600000);
    }
  });

  it("accepts after timestamp", () => {
    const result = MessageQuerySchema.safeParse({ after: "1711929600000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.after).toBe(1711929600000);
    }
  });

  it("accepts both before and after", () => {
    const result = MessageQuerySchema.safeParse({
      before: "1711929700000",
      after: "1711929600000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts includeArchived", () => {
    const result = MessageQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("rejects non-numeric before", () => {
    const result = MessageQuerySchema.safeParse({ before: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects negative before", () => {
    const result = MessageQuerySchema.safeParse({ before: "-1" });
    expect(result.success).toBe(false);
  });
});

describe("MessageTimestampQuerySchema", () => {
  it("accepts empty query", () => {
    const result = MessageTimestampQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timestamp).toBeUndefined();
    }
  });

  it("accepts valid timestamp", () => {
    const result = MessageTimestampQuerySchema.safeParse({
      timestamp: "1711929600000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timestamp).toBe(1711929600000);
    }
  });

  it("rejects non-numeric timestamp", () => {
    const result = MessageTimestampQuerySchema.safeParse({ timestamp: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects negative timestamp", () => {
    const result = MessageTimestampQuerySchema.safeParse({ timestamp: "-1" });
    expect(result.success).toBe(false);
  });
});
