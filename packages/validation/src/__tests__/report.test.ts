import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { BucketExportQuerySchema, GenerateReportBodySchema } from "../report.js";

// ── GenerateReportBodySchema ──────────────────────────────────────

describe("GenerateReportBodySchema", () => {
  it("parses valid member-by-bucket config", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "member-by-bucket",
      bucketId: "bkt_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.reportType === "member-by-bucket") {
      expect(result.data.bucketId).toBe("bkt_550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("parses valid meet-our-system config", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reportType).toBe("meet-our-system");
    }
  });

  it("requires bucketId for member-by-bucket", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "member-by-bucket",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID bucketId", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "member-by-bucket",
      bucketId: "bkt_not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucketId without bkt_ prefix", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "member-by-bucket",
      bucketId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional title up to 200 chars", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      title: "A".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects title exceeding 200 chars", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      title: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string title", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional locale string", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      locale: "en-US",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe("en-US");
    }
  });

  it("rejects missing reportType", () => {
    const result = GenerateReportBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null reportType", () => {
    const result = GenerateReportBodySchema.safeParse({ reportType: null });
    expect(result.success).toBe(false);
  });

  it("rejects unknown reportType", () => {
    const result = GenerateReportBodySchema.safeParse({ reportType: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts locale at MAX_LOCALE_LENGTH boundary", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      locale: "a".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  it("rejects locale exceeding MAX_LOCALE_LENGTH", () => {
    const result = GenerateReportBodySchema.safeParse({
      reportType: "meet-our-system",
      locale: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

// ── BucketExportQuerySchema ───────────────────────────────────────

describe("BucketExportQuerySchema", () => {
  it("parses valid params with defaults", () => {
    const result = BucketExportQuerySchema.safeParse({ entityType: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("member");
      expect(result.data.limit).toBe(50);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it("accepts all 21 BUCKET_CONTENT_ENTITY_TYPES", () => {
    for (const entityType of BUCKET_CONTENT_ENTITY_TYPES) {
      const result = BucketExportQuerySchema.safeParse({ entityType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid entity type", () => {
    const result = BucketExportQuerySchema.safeParse({ entityType: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing entity type", () => {
    const result = BucketExportQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("parses explicit limit", () => {
    const result = BucketExportQuerySchema.safeParse({ entityType: "member", limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit above 100", () => {
    const result = BucketExportQuerySchema.safeParse({ entityType: "member", limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit below 1", () => {
    const result = BucketExportQuerySchema.safeParse({ entityType: "member", limit: "0" });
    expect(result.success).toBe(false);
  });

  it("parses optional cursor", () => {
    const result = BucketExportQuerySchema.safeParse({
      entityType: "member",
      cursor: "abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("abc123");
    }
  });

  it("accepts cursor at MAX_CURSOR_LENGTH boundary", () => {
    const result = BucketExportQuerySchema.safeParse({
      entityType: "member",
      cursor: "a".repeat(1024),
    });
    expect(result.success).toBe(true);
  });

  it("rejects cursor exceeding MAX_CURSOR_LENGTH", () => {
    const result = BucketExportQuerySchema.safeParse({
      entityType: "member",
      cursor: "a".repeat(1025),
    });
    expect(result.success).toBe(false);
  });
});
