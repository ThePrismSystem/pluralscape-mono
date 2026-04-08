import { describe, expect, it } from "vitest";

import { ImportEntityRefQuerySchema } from "../import-entity-ref.js";

describe("ImportEntityRefQuerySchema", () => {
  it("accepts empty query", () => {
    const result = ImportEntityRefQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts importJobId filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ importJobId: "imp_abc" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.importJobId).toBe("imp_abc");
  });

  it("accepts source filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ source: "simply-plural" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid source filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ source: "notion" });
    expect(result.success).toBe(false);
  });

  it("accepts entityType filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ entityType: "member" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid entityType filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ entityType: "banana" });
    expect(result.success).toBe(false);
  });

  it("accepts sourceEntityId filter", () => {
    const result = ImportEntityRefQuerySchema.safeParse({
      sourceEntityId: "507f1f77bcf86cd799439011",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty sourceEntityId", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ sourceEntityId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects sourceEntityId exceeding 128 characters", () => {
    const result = ImportEntityRefQuerySchema.safeParse({
      sourceEntityId: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("accepts all filters combined", () => {
    const result = ImportEntityRefQuerySchema.safeParse({
      importJobId: "imp_1",
      source: "simply-plural",
      entityType: "member",
      sourceEntityId: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty importJobId", () => {
    const result = ImportEntityRefQuerySchema.safeParse({ importJobId: "" });
    expect(result.success).toBe(false);
  });
});
