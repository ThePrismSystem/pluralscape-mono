import { describe, expect, it } from "vitest";

import {
  BucketContentTagQuerySchema,
  BucketQuerySchema,
  CreateBucketBodySchema,
  SetFieldBucketVisibilityBodySchema,
  TagContentBodySchema,
  UpdateBucketBodySchema,
} from "../privacy.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

describe("CreateBucketBodySchema", () => {
  it("accepts valid encryptedData", () => {
    const result = CreateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateBucketBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateBucketBodySchema.safeParse({ encryptedData: "" });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = CreateBucketBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts encryptedData at exactly max size", () => {
    const result = CreateBucketBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE),
    });
    expect(result.success).toBe(true);
  });

  it("strips extra properties", () => {
    const result = CreateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ encryptedData: "dGVzdA==" });
    }
  });
});

describe("UpdateBucketBodySchema", () => {
  it("accepts valid update body", () => {
    const result = UpdateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version less than 1", () => {
    const result = UpdateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateBucketBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateBucketBodySchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
  });
});

describe("BucketQuerySchema", () => {
  it("accepts empty query", () => {
    const result = BucketQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = BucketQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("defaults archivedOnly to false when omitted", () => {
    const result = BucketQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedOnly).toBe(false);
    }
  });

  it("parses archivedOnly boolean", () => {
    const result = BucketQuerySchema.safeParse({ archivedOnly: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedOnly).toBe(true);
    }
  });

  it("rejects invalid archivedOnly value", () => {
    const result = BucketQuerySchema.safeParse({ archivedOnly: "maybe" });
    expect(result.success).toBe(false);
  });
});

describe("TagContentBodySchema", () => {
  it("accepts valid member tag", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "mem_abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("member");
      expect(result.data.entityId).toBe("mem_abc123");
    }
  });

  it("accepts all valid entity types", () => {
    const types = [
      "member",
      "group",
      "channel",
      "message",
      "note",
      "poll",
      "relationship",
      "structure-entity-type",
      "structure-entity",
      "journal-entry",
      "wiki-page",
      "custom-front",
      "fronting-session",
      "board-message",
      "acknowledgement",
      "innerworld-entity",
      "innerworld-region",
      "field-definition",
      "field-value",
      "member-photo",
      "fronting-comment",
    ];
    for (const entityType of types) {
      const result = TagContentBodySchema.safeParse({
        entityType,
        entityId: "id_123",
      });
      expect(result.success, `Expected ${entityType} to be valid`).toBe(true);
    }
  });

  it("rejects invalid entityType", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "invalid",
      entityId: "id_123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityType", () => {
    const result = TagContentBodySchema.safeParse({
      entityId: "id_123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityId", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty entityId", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityId without prefix separator", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "noprefixhere",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityId with uppercase prefix", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "MEM_abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityId with single-char prefix", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "x_id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityId with prefix but empty suffix", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "mem_",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityId with special characters in suffix", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "mem_abc!@#",
    });
    expect(result.success).toBe(false);
  });

  it("accepts entityId with hyphenated UUID suffix", () => {
    const result = TagContentBodySchema.safeParse({
      entityType: "member",
      entityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

describe("BucketContentTagQuerySchema", () => {
  it("accepts empty query", () => {
    const result = BucketContentTagQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts entityType filter alone", () => {
    const result = BucketContentTagQuerySchema.safeParse({
      entityType: "member",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid entityType", () => {
    const result = BucketContentTagQuerySchema.safeParse({
      entityType: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("SetFieldBucketVisibilityBodySchema", () => {
  it("accepts valid body with branded bucket ID", () => {
    const result = SetFieldBucketVisibilityBodySchema.safeParse({
      bucketId: "bkt_12345678-1234-1234-1234-123456789abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing bucketId", () => {
    const result = SetFieldBucketVisibilityBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty bucketId", () => {
    const result = SetFieldBucketVisibilityBodySchema.safeParse({
      bucketId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucketId without bkt_ prefix", () => {
    const result = SetFieldBucketVisibilityBodySchema.safeParse({
      bucketId: "sys_12345678-1234-1234-1234-123456789abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucketId with invalid UUID", () => {
    const result = SetFieldBucketVisibilityBodySchema.safeParse({
      bucketId: "bkt_notauuid",
    });
    expect(result.success).toBe(false);
  });
});
