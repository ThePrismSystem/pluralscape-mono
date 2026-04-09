import { describe, expect, it } from "vitest";

import {
  SPBoardMessageSchema,
  SPChannelCategorySchema,
  SPChannelSchema,
  SPChatMessageSchema,
  SPCommentSchema,
  SPCustomFieldSchema,
  SPFrontHistorySchema,
  SPFrontStatusSchema,
  SPGroupSchema,
  SPImportPayloadSchema,
  SPMemberSchema,
  SPNoteSchema,
  SPPollSchema,
  SPPrivacyBucketSchema,
  SPPrivateSchema,
  SPUserSchema,
} from "../../validators/sp-payload.js";

const validId = "507f1f77bcf86cd799439011";

describe("SPMemberSchema", () => {
  it("accepts a minimal valid member", () => {
    const result = SPMemberSchema.safeParse({ _id: validId, name: "Aria" });
    expect(result.success).toBe(true);
  });

  it("accepts a member with info, buckets, and legacy private flags", () => {
    const result = SPMemberSchema.safeParse({
      _id: validId,
      name: "Aria",
      info: { fld_1: "value" },
      buckets: ["bkt_1", "bkt_2"],
      private: false,
      preventTrusted: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a member missing required fields", () => {
    const result = SPMemberSchema.safeParse({ _id: validId });
    expect(result.success).toBe(false);
  });

  it("rejects an empty _id", () => {
    const result = SPMemberSchema.safeParse({ _id: "", name: "Aria" });
    expect(result.success).toBe(false);
  });

  it("passes through unknown fields so mappers can emit unknown-field warnings", () => {
    const result = SPMemberSchema.safeParse({
      _id: validId,
      name: "Aria",
      __unknown__: "keep me",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("__unknown__" in result.data).toBe(true);
    }
  });
});

describe("SPFrontStatusSchema", () => {
  it("accepts a minimal valid frontStatus", () => {
    const result = SPFrontStatusSchema.safeParse({
      _id: validId,
      name: "Tired",
    });
    expect(result.success).toBe(true);
  });
  it("rejects when name is missing", () => {
    expect(SPFrontStatusSchema.safeParse({ _id: validId }).success).toBe(false);
  });
});

describe("SPGroupSchema", () => {
  it("requires members array (may be empty)", () => {
    expect(SPGroupSchema.safeParse({ _id: validId, name: "Pod", members: [] }).success).toBe(true);
    expect(SPGroupSchema.safeParse({ _id: validId, name: "Pod" }).success).toBe(false);
  });
});

describe("SPCustomFieldSchema", () => {
  it("requires name, type, order", () => {
    expect(
      SPCustomFieldSchema.safeParse({
        _id: validId,
        name: "Likes",
        type: "text",
        order: 0,
      }).success,
    ).toBe(true);
    expect(SPCustomFieldSchema.safeParse({ _id: validId, name: "Likes" }).success).toBe(false);
  });
});

describe("SPFrontHistorySchema", () => {
  it("accepts a member front in progress (live: true, endTime: null)", () => {
    expect(
      SPFrontHistorySchema.safeParse({
        _id: validId,
        member: "mem_id",
        custom: false,
        live: true,
        startTime: 1_000_000,
        endTime: null,
      }).success,
    ).toBe(true);
  });
  it("accepts a custom front entry", () => {
    expect(
      SPFrontHistorySchema.safeParse({
        _id: validId,
        member: "cf_id",
        custom: true,
        live: false,
        startTime: 1_000_000,
        endTime: 2_000_000,
      }).success,
    ).toBe(true);
  });
  it("rejects negative startTime", () => {
    expect(
      SPFrontHistorySchema.safeParse({
        _id: validId,
        member: "mem_id",
        custom: false,
        live: true,
        startTime: -1,
        endTime: null,
      }).success,
    ).toBe(false);
  });
});

describe("SPCommentSchema", () => {
  it("accepts a valid comment with documentId", () => {
    expect(
      SPCommentSchema.safeParse({
        _id: validId,
        documentId: "fh_id",
        text: "hi",
        time: 1_000_000,
      }).success,
    ).toBe(true);
  });
});

describe("SPNoteSchema", () => {
  it("accepts a member-bound note", () => {
    expect(
      SPNoteSchema.safeParse({
        _id: validId,
        title: "T",
        note: "body",
        date: 1_000_000,
        member: "mem_id",
      }).success,
    ).toBe(true);
  });
});

describe("SPPollSchema", () => {
  it("accepts a poll with options and embedded votes", () => {
    expect(
      SPPollSchema.safeParse({
        _id: validId,
        name: "Dinner",
        options: [
          { id: "o1", name: "Pizza" },
          { id: "o2", name: "Sushi" },
        ],
        votes: [{ id: "v1", vote: "o1" }],
      }).success,
    ).toBe(true);
  });
  it("accepts a poll with no votes", () => {
    expect(
      SPPollSchema.safeParse({
        _id: validId,
        name: "Dinner",
        options: [{ id: "o1", name: "A" }],
      }).success,
    ).toBe(true);
  });
});

describe("SPChannelCategorySchema and SPChannelSchema", () => {
  it("accepts a category", () => {
    expect(SPChannelCategorySchema.safeParse({ _id: validId, name: "Day" }).success).toBe(true);
  });
  it("accepts a channel under a category", () => {
    expect(
      SPChannelSchema.safeParse({
        _id: validId,
        name: "general",
        parentCategory: "cat_id",
      }).success,
    ).toBe(true);
  });
  it("accepts a channel with null parentCategory", () => {
    expect(
      SPChannelSchema.safeParse({
        _id: validId,
        name: "general",
        parentCategory: null,
      }).success,
    ).toBe(true);
  });
});

describe("SPChatMessageSchema", () => {
  it("accepts a chat message", () => {
    expect(
      SPChatMessageSchema.safeParse({
        _id: validId,
        channel: "ch_id",
        writer: "mem_id",
        message: "hi",
        writtenAt: 1_000_000,
      }).success,
    ).toBe(true);
  });
});

describe("SPBoardMessageSchema", () => {
  it("accepts a board message", () => {
    expect(
      SPBoardMessageSchema.safeParse({
        _id: validId,
        title: "T",
        message: "body",
        writer: "mem_id",
        writtenAt: 1_000_000,
      }).success,
    ).toBe(true);
  });
});

describe("SPPrivacyBucketSchema", () => {
  it("accepts a bucket", () => {
    expect(SPPrivacyBucketSchema.safeParse({ _id: validId, name: "Trusted" }).success).toBe(true);
  });
});

describe("SPUserSchema and SPPrivateSchema", () => {
  it("accepts a user cherry-pick", () => {
    expect(SPUserSchema.safeParse({ _id: validId, username: "Aria's System" }).success).toBe(true);
  });
  it("accepts a private cherry-pick with notification toggles", () => {
    expect(
      SPPrivateSchema.safeParse({
        _id: validId,
        locale: "en",
        frontNotifs: true,
      }).success,
    ).toBe(true);
  });
});

describe("SPImportPayloadSchema", () => {
  it("accepts an empty payload (every collection optional)", () => {
    expect(SPImportPayloadSchema.safeParse({}).success).toBe(true);
  });
  it("accepts a partial payload with just members", () => {
    expect(
      SPImportPayloadSchema.safeParse({
        members: [{ _id: validId, name: "Aria" }],
      }).success,
    ).toBe(true);
  });
  it("rejects a payload with a malformed member inside the array", () => {
    expect(SPImportPayloadSchema.safeParse({ members: [{ _id: validId }] }).success).toBe(false);
  });
});
