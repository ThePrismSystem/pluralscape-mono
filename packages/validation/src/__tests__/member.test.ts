import { describe, expect, it } from "vitest";

import { MemberListQuerySchema } from "../member.js";

describe("MemberListQuerySchema", () => {
  it("accepts empty query", () => {
    const result = MemberListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid groupId with grp_ prefix", () => {
    const result = MemberListQuerySchema.safeParse({
      groupId: "grp_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects groupId with wrong prefix", () => {
    const result = MemberListQuerySchema.safeParse({
      groupId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects groupId without valid UUID suffix", () => {
    const result = MemberListQuerySchema.safeParse({
      groupId: "grp_not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts includeArchived boolean string", () => {
    const result = MemberListQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
  });

  it("accepts groupId with includeArchived", () => {
    const result = MemberListQuerySchema.safeParse({
      groupId: "grp_550e8400-e29b-41d4-a716-446655440000",
      includeArchived: "true",
    });
    expect(result.success).toBe(true);
  });
});
