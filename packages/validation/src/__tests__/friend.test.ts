import { describe, expect, it } from "vitest";

import {
  AssignBucketBodySchema,
  FriendCodeQuerySchema,
  FriendConnectionQuerySchema,
  RedeemFriendCodeBodySchema,
  UpdateFriendVisibilityBodySchema,
} from "../friend.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

// ── RedeemFriendCodeBodySchema ──────────────────────────────────────

describe("RedeemFriendCodeBodySchema", () => {
  it("accepts valid XXXX-XXXX code", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "ABCD-1234" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("ABCD-1234");
    }
  });

  it("accepts all-uppercase alphanumeric", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "A1B2-C3D4" });
    expect(result.success).toBe(true);
  });

  it("accepts all-numeric code", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "1234-5678" });
    expect(result.success).toBe(true);
  });

  it("rejects lowercase code", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "abcd-1234" });
    expect(result.success).toBe(false);
  });

  it("rejects code without dash", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "ABCD1234" });
    expect(result.success).toBe(false);
  });

  it("rejects too-short code", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "ABC-1234" });
    expect(result.success).toBe(false);
  });

  it("rejects too-long code (three segments)", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({
      code: "ABCD-1234-EFGH",
    });
    expect(result.success).toBe(false);
  });

  it("rejects code with spaces", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "ABCD EFGH" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({ code: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code field", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = RedeemFriendCodeBodySchema.safeParse({
      code: "ABCD-1234",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ code: "ABCD-1234" });
    }
  });
});

// ── UpdateFriendVisibilityBodySchema ────────────────────────────────

describe("UpdateFriendVisibilityBodySchema", () => {
  it("accepts valid encryptedData and version", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty encryptedData", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts encryptedData at exactly max size", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE),
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects version less than 1", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateFriendVisibilityBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

// ── AssignBucketBodySchema ──────────────────────────────────────────

describe("AssignBucketBodySchema", () => {
  const validBody = {
    connectionId: "fc_12345678-1234-1234-1234-123456789abc",
    encryptedBucketKey: "dGVzdA==",
    keyVersion: 1,
  };

  it("accepts valid body", () => {
    const result = AssignBucketBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("rejects missing connectionId", () => {
    const result = AssignBucketBodySchema.safeParse({
      encryptedBucketKey: validBody.encryptedBucketKey,
      keyVersion: validBody.keyVersion,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty connectionId", () => {
    const result = AssignBucketBodySchema.safeParse({
      ...validBody,
      connectionId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedBucketKey", () => {
    const result = AssignBucketBodySchema.safeParse({
      connectionId: validBody.connectionId,
      keyVersion: validBody.keyVersion,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedBucketKey", () => {
    const result = AssignBucketBodySchema.safeParse({
      ...validBody,
      encryptedBucketKey: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing keyVersion", () => {
    const result = AssignBucketBodySchema.safeParse({
      connectionId: validBody.connectionId,
      encryptedBucketKey: validBody.encryptedBucketKey,
    });
    expect(result.success).toBe(false);
  });

  it("rejects keyVersion less than 1", () => {
    const result = AssignBucketBodySchema.safeParse({
      ...validBody,
      keyVersion: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer keyVersion", () => {
    const result = AssignBucketBodySchema.safeParse({
      ...validBody,
      keyVersion: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

// ── FriendConnectionQuerySchema ─────────────────────────────────────

describe("FriendConnectionQuerySchema", () => {
  it("accepts empty query (defaults)", () => {
    const result = FriendConnectionQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("accepts explicit limit", () => {
    const result = FriendConnectionQuerySchema.safeParse({ limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("accepts limit at minimum boundary (1)", () => {
    const result = FriendConnectionQuerySchema.safeParse({ limit: "1" });
    expect(result.success).toBe(true);
  });

  it("accepts limit at maximum boundary (100)", () => {
    const result = FriendConnectionQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
  });

  it("rejects limit of 0", () => {
    const result = FriendConnectionQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit exceeding 100", () => {
    const result = FriendConnectionQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("accepts optional cursor", () => {
    const result = FriendConnectionQuerySchema.safeParse({
      cursor: "some-cursor",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("some-cursor");
    }
  });
});

// ── FriendCodeQuerySchema ───────────────────────────────────────────

describe("FriendCodeQuerySchema", () => {
  it("accepts empty query", () => {
    const result = FriendCodeQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses includeExpired boolean", () => {
    const result = FriendCodeQuerySchema.safeParse({ includeExpired: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeExpired).toBe(true);
    }
  });

  it("parses includeExpired false", () => {
    const result = FriendCodeQuerySchema.safeParse({ includeExpired: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeExpired).toBe(false);
    }
  });
});
