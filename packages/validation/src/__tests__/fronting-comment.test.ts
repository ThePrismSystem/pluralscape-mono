import { describe, expect, it } from "vitest";

import {
  CreateFrontingCommentBodySchema,
  UpdateFrontingCommentBodySchema,
} from "../fronting-comment.js";

// ── helpers ──────────────────────────────────────────────────────────

/** Valid branded IDs for testing. */
const MEM_ID_1 = "mem_00000000-0000-0000-0000-000000000001";
const CF_ID_1 = "cf_00000000-0000-0000-0000-000000000001";
const STE_ID_1 = "ste_00000000-0000-0000-0000-000000000001";

// ── CreateFrontingCommentBodySchema ──────────────────────────────────

describe("CreateFrontingCommentBodySchema", () => {
  it("accepts valid input with memberId only", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with customFrontId only", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      customFrontId: CF_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with structureEntityId only", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      structureEntityId: STE_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when all three subjects are missing", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
    });
    expect(result.success).toBe(false);
  });

  // ── Branded ID validation ──────────────────────────────────────

  it("accepts memberId with correct prefix", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects memberId with wrong prefix", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: "cf_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("rejects memberId with malformed UUID", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: "mem_not-a-valid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customFrontId with wrong prefix", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      customFrontId: "mem_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("rejects structureEntityId with wrong prefix", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      structureEntityId: "mem_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  // ── encryptedData validation ───────────────────────────────────

  it("rejects missing encryptedData", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "",
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = CreateFrontingCommentBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: MEM_ID_1,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── UpdateFrontingCommentBodySchema ──────────────────────────────────

describe("UpdateFrontingCommentBodySchema", () => {
  it("accepts valid input with version >= 1 and encryptedData", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts version greater than 1", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version of 0", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative version", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      encryptedData: "updated-data",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateFrontingCommentBodySchema.safeParse({
      encryptedData: "updated-data",
    });
    expect(result.success).toBe(false);
  });
});
