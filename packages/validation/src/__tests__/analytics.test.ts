import { describe, expect, it } from "vitest";

import { AnalyticsQuerySchema, CreateFrontingReportBodySchema } from "../analytics.js";

describe("AnalyticsQuerySchema", () => {
  it("accepts empty query (defaults to last-30-days)", () => {
    const result = AnalyticsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts preset without dates", () => {
    const result = AnalyticsQuerySchema.safeParse({ preset: "last-7-days" });
    expect(result.success).toBe(true);
  });

  it("accepts all-time preset", () => {
    const result = AnalyticsQuerySchema.safeParse({ preset: "all-time" });
    expect(result.success).toBe(true);
  });

  it("accepts custom preset with dates", () => {
    const result = AnalyticsQuerySchema.safeParse({
      preset: "custom",
      startDate: "1000",
      endDate: "2000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects custom preset without dates", () => {
    const result = AnalyticsQuerySchema.safeParse({ preset: "custom" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid preset", () => {
    const result = AnalyticsQuerySchema.safeParse({ preset: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const result = AnalyticsQuerySchema.safeParse({
      preset: "custom",
      startDate: "2000",
      endDate: "1000",
    });
    expect(result.success).toBe(false);
  });

  it("transforms string dates to numbers", () => {
    const result = AnalyticsQuerySchema.safeParse({
      preset: "custom",
      startDate: "1000",
      endDate: "2000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBe(1000);
      expect(result.data.endDate).toBe(2000);
    }
  });
});

describe("CreateFrontingReportBodySchema", () => {
  it("accepts valid payload", () => {
    const result = CreateFrontingReportBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      format: "html",
      generatedAt: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts pdf format", () => {
    const result = CreateFrontingReportBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      format: "pdf",
      generatedAt: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateFrontingReportBodySchema.safeParse({
      format: "html",
      generatedAt: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid format", () => {
    const result = CreateFrontingReportBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      format: "csv",
      generatedAt: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative generatedAt", () => {
    const result = CreateFrontingReportBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      format: "html",
      generatedAt: -1,
    });
    expect(result.success).toBe(false);
  });
});
