import { describe, expect, it } from "vitest";

import {
  AddGroupMemberBodySchema,
  CreateGroupBodySchema,
  MoveGroupBodySchema,
  ReorderGroupsBodySchema,
  UpdateGroupBodySchema,
} from "../group.js";
import { MAX_ENCRYPTED_GROUP_DATA_SIZE } from "../validation.constants.js";

describe("CreateGroupBodySchema", () => {
  it("accepts a valid body", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-null parentGroupId", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      parentGroupId: "grp_550e8400-e29b-41d4-a716-446655440000",
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateGroupBodySchema.safeParse({
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "",
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const oversized = "x".repeat(MAX_ENCRYPTED_GROUP_DATA_SIZE + 1);
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: oversized,
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts encryptedData at exactly max size", () => {
    const atLimit = "x".repeat(MAX_ENCRYPTED_GROUP_DATA_SIZE);
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: atLimit,
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it("strips extra properties", () => {
    const result = CreateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: 0,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
        parentGroupId: null,
        sortOrder: 0,
      });
    }
  });
});

describe("UpdateGroupBodySchema", () => {
  it("accepts a valid body", () => {
    const result = UpdateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version less than 1", () => {
    const result = UpdateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateGroupBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("MoveGroupBodySchema", () => {
  it("accepts null targetParentGroupId", () => {
    const result = MoveGroupBodySchema.safeParse({
      targetParentGroupId: null,
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-null targetParentGroupId", () => {
    const result = MoveGroupBodySchema.safeParse({
      targetParentGroupId: "grp_550e8400-e29b-41d4-a716-446655440000",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty targetParentGroupId string", () => {
    const result = MoveGroupBodySchema.safeParse({
      targetParentGroupId: "",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = MoveGroupBodySchema.safeParse({
      targetParentGroupId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("ReorderGroupsBodySchema", () => {
  it("accepts valid operations", () => {
    const result = ReorderGroupsBodySchema.safeParse({
      operations: [{ groupId: "grp_abc", sortOrder: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty operations array", () => {
    const result = ReorderGroupsBodySchema.safeParse({
      operations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 operations", () => {
    const ops = Array.from({ length: 101 }, (_, i) => ({
      groupId: `grp_${String(i)}`,
      sortOrder: i,
    }));
    const result = ReorderGroupsBodySchema.safeParse({ operations: ops });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder in operations", () => {
    const result = ReorderGroupsBodySchema.safeParse({
      operations: [{ groupId: "grp_abc", sortOrder: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("AddGroupMemberBodySchema", () => {
  it("accepts a valid memberId", () => {
    const result = AddGroupMemberBodySchema.safeParse({
      memberId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty memberId", () => {
    const result = AddGroupMemberBodySchema.safeParse({
      memberId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing memberId", () => {
    const result = AddGroupMemberBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
