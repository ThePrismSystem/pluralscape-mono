import { describe, expect, it } from "vitest";

import {
  ImportEntityRefLookupBatchBodySchema,
  ImportEntityRefQuerySchema,
  ImportEntityRefUpsertBatchBodySchema,
} from "../import-entity-ref.js";
import { IMPORT_ENTITY_REF_BATCH_MAX } from "../validation.constants.js";

describe("ImportEntityRefQuerySchema", () => {
  it("accepts empty query", () => {
    const result = ImportEntityRefQuerySchema.safeParse({});
    expect(result.success).toBe(true);
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
      source: "simply-plural",
      entityType: "member",
      sourceEntityId: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts every entity type added in plan 1", () => {
    const newTypes = [
      "system-profile",
      "system-settings",
      "journal-entry",
      "custom-front",
      "fronting-comment",
      "field-definition",
      "field-value",
      "channel-category",
      "channel",
    ] as const;
    for (const entityType of newTypes) {
      const result = ImportEntityRefQuerySchema.safeParse({ entityType });
      expect(result.success, `entityType=${entityType}`).toBe(true);
    }
  });
});

describe("ImportEntityRefLookupBatchBodySchema", () => {
  it("accepts a minimal valid body", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: ["507f1f77bcf86cd799439011"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts up to IMPORT_ENTITY_REF_BATCH_MAX entries", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: Array.from(
        { length: IMPORT_ENTITY_REF_BATCH_MAX },
        (_, i) => `id-${String(i)}`,
      ),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty sourceEntityIds array", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than IMPORT_ENTITY_REF_BATCH_MAX entries", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: Array.from(
        { length: IMPORT_ENTITY_REF_BATCH_MAX + 1 },
        (_, i) => `id-${String(i)}`,
      ),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source enum", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "notion",
      sourceEntityType: "member",
      sourceEntityIds: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sourceEntityType enum", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "banana",
      sourceEntityIds: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty sourceEntityId string", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: [""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects sourceEntityId exceeding 128 characters", () => {
    const result = ImportEntityRefLookupBatchBodySchema.safeParse({
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: ["a".repeat(129)],
    });
    expect(result.success).toBe(false);
  });
});

describe("ImportEntityRefUpsertBatchBodySchema", () => {
  it("accepts a minimal valid body", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: [
        {
          sourceEntityType: "member",
          sourceEntityId: "507f1f77bcf86cd799439011",
          pluralscapeEntityId: "mem_target_1",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts up to IMPORT_ENTITY_REF_BATCH_MAX entries", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: Array.from({ length: IMPORT_ENTITY_REF_BATCH_MAX }, (_, i) => ({
        sourceEntityType: "member" as const,
        sourceEntityId: `id-${String(i)}`,
        pluralscapeEntityId: `mem_${String(i)}`,
      })),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty entries array", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than IMPORT_ENTITY_REF_BATCH_MAX entries", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: Array.from({ length: IMPORT_ENTITY_REF_BATCH_MAX + 1 }, (_, i) => ({
        sourceEntityType: "member" as const,
        sourceEntityId: `id-${String(i)}`,
        pluralscapeEntityId: `mem_${String(i)}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source enum", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "notion",
      entries: [{ sourceEntityType: "member", sourceEntityId: "x", pluralscapeEntityId: "y" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sourceEntityType in an entry", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: [{ sourceEntityType: "banana", sourceEntityId: "x", pluralscapeEntityId: "y" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty pluralscapeEntityId", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: [{ sourceEntityType: "member", sourceEntityId: "x", pluralscapeEntityId: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects pluralscapeEntityId longer than 50 characters", () => {
    const result = ImportEntityRefUpsertBatchBodySchema.safeParse({
      source: "simply-plural",
      entries: [
        {
          sourceEntityType: "member",
          sourceEntityId: "src_1",
          pluralscapeEntityId: "x".repeat(51),
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
