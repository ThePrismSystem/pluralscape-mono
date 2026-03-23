import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { DATE_RANGE_PRESETS } from "../analytics.js";

import type {
  ChartData,
  ChartDataset,
  CoFrontingAnalytics,
  CoFrontingPair,
  DateRangeFilter,
  DateRangePreset,
  Duration,
  FrontingAnalytics,
  FrontingReport,
  FrontingSubjectType,
  MemberFrontingBreakdown,
  SubjectFrontingBreakdown,
} from "../analytics.js";
import type {
  CustomFrontId,
  FrontingReportId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
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

describe("FrontingSubjectType", () => {
  it("accepts valid subject types", () => {
    assertType<FrontingSubjectType>("member");
    assertType<FrontingSubjectType>("customFront");
    assertType<FrontingSubjectType>("structureEntity");
  });

  it("rejects invalid subject types", () => {
    // @ts-expect-error invalid subject type
    assertType<FrontingSubjectType>("unknown");
  });
});

describe("SubjectFrontingBreakdown", () => {
  it("has correct field types", () => {
    expectTypeOf<SubjectFrontingBreakdown["subjectType"]>().toEqualTypeOf<FrontingSubjectType>();
    expectTypeOf<SubjectFrontingBreakdown["subjectId"]>().toEqualTypeOf<
      MemberId | CustomFrontId | SystemStructureEntityId
    >();
    expectTypeOf<SubjectFrontingBreakdown["totalDuration"]>().toEqualTypeOf<Duration>();
    expectTypeOf<SubjectFrontingBreakdown["sessionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<SubjectFrontingBreakdown["averageSessionLength"]>().toEqualTypeOf<Duration>();
    expectTypeOf<SubjectFrontingBreakdown["percentageOfTotal"]>().toEqualTypeOf<number>();
  });
});

describe("FrontingAnalytics", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingAnalytics["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingAnalytics["dateRange"]>().toEqualTypeOf<DateRangeFilter>();
    expectTypeOf<FrontingAnalytics["subjectBreakdowns"]>().toEqualTypeOf<
      readonly SubjectFrontingBreakdown[]
    >();
    expectTypeOf<FrontingAnalytics["truncated"]>().toEqualTypeOf<boolean>();
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

describe("CoFrontingPair", () => {
  it("has correct field types", () => {
    expectTypeOf<CoFrontingPair["memberA"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<CoFrontingPair["memberB"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<CoFrontingPair["totalDuration"]>().toEqualTypeOf<Duration>();
    expectTypeOf<CoFrontingPair["sessionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<CoFrontingPair["percentageOfTotal"]>().toEqualTypeOf<number>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof CoFrontingPair>().toEqualTypeOf<
      "memberA" | "memberB" | "totalDuration" | "sessionCount" | "percentageOfTotal"
    >();
  });
});

describe("CoFrontingAnalytics", () => {
  it("has correct field types", () => {
    expectTypeOf<CoFrontingAnalytics["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CoFrontingAnalytics["dateRange"]>().toEqualTypeOf<DateRangeFilter>();
    expectTypeOf<CoFrontingAnalytics["coFrontingPercentage"]>().toEqualTypeOf<number>();
    expectTypeOf<CoFrontingAnalytics["pairs"]>().toEqualTypeOf<readonly CoFrontingPair[]>();
    expectTypeOf<CoFrontingAnalytics["truncated"]>().toEqualTypeOf<boolean>();
  });
});

describe("DATE_RANGE_PRESETS", () => {
  it("is an array with exactly 6 items", () => {
    expectTypeOf(DATE_RANGE_PRESETS).toExtend<readonly string[]>();
    expect(DATE_RANGE_PRESETS).toHaveLength(6);
  });

  it("contains all presets", () => {
    expect(DATE_RANGE_PRESETS).toContain("last-7-days");
    expect(DATE_RANGE_PRESETS).toContain("last-30-days");
    expect(DATE_RANGE_PRESETS).toContain("last-90-days");
    expect(DATE_RANGE_PRESETS).toContain("last-year");
    expect(DATE_RANGE_PRESETS).toContain("all-time");
    expect(DATE_RANGE_PRESETS).toContain("custom");
  });
});
