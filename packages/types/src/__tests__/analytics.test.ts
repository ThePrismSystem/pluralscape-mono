import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ChartData,
  ChartDataset,
  DateRangeFilter,
  DateRangePreset,
  Duration,
  FrontingAnalytics,
  FrontingReport,
  MemberFrontingBreakdown,
} from "../analytics.js";
import type { FrontingReportId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { DateRange } from "../utility.js";

describe("Duration", () => {
  it("extends number", () => {
    expectTypeOf<Duration>().toExtend<number>();
  });

  it("is not assignable from plain number", () => {
    // @ts-expect-error plain number not assignable to Duration
    assertType<Duration>(1000);
  });
});

describe("DateRangePreset", () => {
  it("accepts valid presets", () => {
    assertType<DateRangePreset>("last-7-days");
    assertType<DateRangePreset>("last-30-days");
    assertType<DateRangePreset>("last-90-days");
    assertType<DateRangePreset>("last-year");
    assertType<DateRangePreset>("all-time");
    assertType<DateRangePreset>("custom");
  });

  it("rejects invalid presets", () => {
    // @ts-expect-error invalid preset
    assertType<DateRangePreset>("decade");
  });

  it("is exhaustive in a switch", () => {
    function handlePreset(preset: DateRangePreset): string {
      switch (preset) {
        case "last-7-days":
        case "last-30-days":
        case "last-90-days":
        case "last-year":
        case "all-time":
        case "custom":
          return preset;
        default: {
          const _exhaustive: never = preset;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handlePreset).toBeFunction();
  });
});

describe("DateRangeFilter", () => {
  it("extends DateRange", () => {
    expectTypeOf<DateRangeFilter>().toExtend<DateRange>();
  });

  it("has correct field types", () => {
    expectTypeOf<DateRangeFilter["start"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DateRangeFilter["end"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DateRangeFilter["preset"]>().toEqualTypeOf<DateRangePreset | null>();
  });
});

describe("MemberFrontingBreakdown", () => {
  it("has correct field types", () => {
    expectTypeOf<MemberFrontingBreakdown["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberFrontingBreakdown["totalDuration"]>().toEqualTypeOf<Duration>();
    expectTypeOf<MemberFrontingBreakdown["sessionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberFrontingBreakdown["averageSessionLength"]>().toEqualTypeOf<Duration>();
    expectTypeOf<MemberFrontingBreakdown["percentageOfTotal"]>().toEqualTypeOf<number>();
  });
});

describe("FrontingAnalytics", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingAnalytics["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingAnalytics["dateRange"]>().toEqualTypeOf<DateRange>();
    expectTypeOf<FrontingAnalytics["memberBreakdowns"]>().toEqualTypeOf<
      readonly MemberFrontingBreakdown[]
    >();
  });
});

describe("FrontingReport", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingReport["id"]>().toEqualTypeOf<FrontingReportId>();
    expectTypeOf<FrontingReport["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingReport["dateRange"]>().toEqualTypeOf<DateRange>();
    expectTypeOf<FrontingReport["memberBreakdowns"]>().toEqualTypeOf<
      readonly MemberFrontingBreakdown[]
    >();
    expectTypeOf<FrontingReport["chartData"]>().toEqualTypeOf<readonly ChartData[]>();
    expectTypeOf<FrontingReport["format"]>().toEqualTypeOf<"html" | "pdf">();
    expectTypeOf<FrontingReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ChartDataset", () => {
  it("has correct field types", () => {
    expectTypeOf<ChartDataset["label"]>().toBeString();
    expectTypeOf<ChartDataset["data"]>().toEqualTypeOf<readonly number[]>();
    expectTypeOf<ChartDataset["color"]>().toBeString();
  });
});

describe("ChartData", () => {
  it("has correct field types", () => {
    expectTypeOf<ChartData["chartType"]>().toEqualTypeOf<"pie" | "bar" | "timeline">();
    expectTypeOf<ChartData["labels"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<ChartData["datasets"]>().toEqualTypeOf<readonly ChartDataset[]>();
  });
});
