import { describe, expect, it } from "vitest";

import { FriendExportQuerySchema } from "../friend-export.js";

describe("FriendExportQuerySchema", () => {
  it("parses valid params with defaults", () => {
    const result = FriendExportQuerySchema.safeParse({ entityType: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("member");
      expect(result.data.limit).toBe(50);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it("parses all valid entity types", () => {
    for (const entityType of [
      "member",
      "group",
      "channel",
      "custom-front",
      "fronting-session",
      "innerworld-entity",
    ]) {
      const result = FriendExportQuerySchema.safeParse({ entityType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid entity type", () => {
    const result = FriendExportQuerySchema.safeParse({ entityType: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing entity type", () => {
    const result = FriendExportQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("parses explicit limit", () => {
    const result = FriendExportQuerySchema.safeParse({ entityType: "member", limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit above maximum", () => {
    const result = FriendExportQuerySchema.safeParse({ entityType: "member", limit: "200" });
    expect(result.success).toBe(false);
  });

  it("rejects limit below minimum", () => {
    const result = FriendExportQuerySchema.safeParse({ entityType: "member", limit: "0" });
    expect(result.success).toBe(false);
  });

  it("parses cursor when provided", () => {
    const result = FriendExportQuerySchema.safeParse({
      entityType: "member",
      cursor: "abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("abc123");
    }
  });
});
