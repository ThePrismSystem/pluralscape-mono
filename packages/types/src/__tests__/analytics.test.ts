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
import type { MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

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
    assertType<DateRangePreset>("today");
    assertType<DateRangePreset>("week");
    assertType<DateRangePreset>("month");
    assertType<DateRangePreset>("quarter");
    assertType<DateRangePreset>("year");
    assertType<DateRangePreset>("all-time");
  });

  it("rejects invalid presets", () => {
    // @ts-expect-error invalid preset
    assertType<DateRangePreset>("decade");
  });
});

describe("DateRangeFilter", () => {
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
    expectTypeOf<MemberFrontingBreakdown["averageDuration"]>().toEqualTypeOf<Duration>();
    expectTypeOf<MemberFrontingBreakdown["percentage"]>().toEqualTypeOf<number>();
  });
});

describe("FrontingAnalytics", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingAnalytics["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingAnalytics["filter"]>().toEqualTypeOf<DateRangeFilter>();
    expectTypeOf<FrontingAnalytics["totalDuration"]>().toEqualTypeOf<Duration>();
    expectTypeOf<FrontingAnalytics["totalSessions"]>().toEqualTypeOf<number>();
    expectTypeOf<FrontingAnalytics["memberBreakdowns"]>().toEqualTypeOf<
      readonly MemberFrontingBreakdown[]
    >();
  });
});

describe("FrontingReport", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingReport["analytics"]>().toEqualTypeOf<FrontingAnalytics>();
    expectTypeOf<FrontingReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ChartDataset", () => {
  it("has correct field types", () => {
    expectTypeOf<ChartDataset["label"]>().toBeString();
    expectTypeOf<ChartDataset["data"]>().toEqualTypeOf<readonly number[]>();
  });
});

describe("ChartData", () => {
  it("has correct field types", () => {
    expectTypeOf<ChartData["labels"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<ChartData["datasets"]>().toEqualTypeOf<readonly ChartDataset[]>();
  });
});
