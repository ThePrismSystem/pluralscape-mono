import { describe, expect, it } from "vitest";

import {
  BoardMessageQuerySchema,
  CreateBoardMessageBodySchema,
  ReorderBoardMessagesBodySchema,
  UpdateBoardMessageBodySchema,
} from "../board-message.js";
import { MAX_ENCRYPTED_DATA_SIZE, MAX_REORDER_OPERATIONS } from "../validation.constants.js";

const VALID_BM_ID = "bm_12345678-1234-1234-1234-123456789abc";

describe("CreateBoardMessageBodySchema", () => {
  it("accepts a valid body", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(false);
    }
  });

  it("accepts pinned=true", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 0,
      pinned: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(true);
    }
  });

  it("defaults pinned to false when omitted", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(false);
    }
  });

  it("rejects missing encryptedData", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sortOrder", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 0,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
        sortOrder: 0,
        pinned: false,
      });
    }
  });
});

describe("UpdateBoardMessageBodySchema", () => {
  it("accepts a valid update body", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with optional sortOrder", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 2,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it("accepts update with optional pinned", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      pinned: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(true);
    }
  });

  it("rejects version less than 1", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = UpdateBoardMessageBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ReorderBoardMessagesBodySchema", () => {
  it("accepts valid operations", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [
        { boardMessageId: VALID_BM_ID, sortOrder: 0 },
        { boardMessageId: "bm_22345678-1234-1234-1234-123456789abc", sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts single operation", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [{ boardMessageId: VALID_BM_ID, sortOrder: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty operations array", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects operations exceeding max", () => {
    const ops = Array.from({ length: MAX_REORDER_OPERATIONS + 1 }, (_, i) => ({
      boardMessageId: `bm_${String(i).padStart(8, "0")}-1234-1234-1234-123456789abc`,
      sortOrder: i,
    }));
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: ops,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder in operation", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [{ boardMessageId: VALID_BM_ID, sortOrder: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing boardMessageId", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [{ sortOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sortOrder in operation", () => {
    const result = ReorderBoardMessagesBodySchema.safeParse({
      operations: [{ boardMessageId: VALID_BM_ID }],
    });
    expect(result.success).toBe(false);
  });
});

describe("BoardMessageQuerySchema", () => {
  it("accepts empty query", () => {
    const result = BoardMessageQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts includeArchived filter", () => {
    const result = BoardMessageQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("transforms includeArchived false", () => {
    const result = BoardMessageQuerySchema.safeParse({ includeArchived: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });

  it("accepts pinned filter", () => {
    const result = BoardMessageQuerySchema.safeParse({ pinned: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(true);
    }
  });

  it("accepts pinned false filter", () => {
    const result = BoardMessageQuerySchema.safeParse({ pinned: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pinned).toBe(false);
    }
  });
});
