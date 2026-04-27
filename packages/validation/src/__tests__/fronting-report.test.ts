import { describe, expect, it } from "vitest";

import { FrontingReportEncryptedInputSchema } from "../fronting-report.js";

const VALID = {
  dateRange: { start: 1_700_000_000_000, end: 1_700_086_400_000 },
  memberBreakdowns: [],
  chartData: [],
};

describe("FrontingReportEncryptedInputSchema", () => {
  it("accepts an empty valid payload", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("accepts a populated memberBreakdown", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      memberBreakdowns: [
        {
          memberId: "mem_1",
          totalDuration: 3_600_000,
          sessionCount: 4,
          averageSessionLength: 900_000,
          percentageOfTotal: 25.5,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a populated chartData entry", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      chartData: [
        {
          chartType: "pie",
          labels: ["A", "B"],
          datasets: [{ label: "All", data: [1, 2], color: "#ff0000" }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dateRange where start > end", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      dateRange: { start: 100, end: 50 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a dateRange where start === end (boundary)", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      dateRange: { start: 1_700_000_000_000, end: 1_700_000_000_000 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid chartType", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      chartData: [{ chartType: "scatter", labels: [], datasets: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a percentageOfTotal outside [0, 100]", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      ...VALID,
      memberBreakdowns: [
        {
          memberId: "mem_1",
          totalDuration: 1,
          sessionCount: 1,
          averageSessionLength: 1,
          percentageOfTotal: 150,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing top-level field", () => {
    const result = FrontingReportEncryptedInputSchema.safeParse({
      dateRange: VALID.dateRange,
      memberBreakdowns: [],
      // chartData omitted
    });
    expect(result.success).toBe(false);
  });
});
