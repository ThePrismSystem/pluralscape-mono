import { describe, expect, it } from "vitest";

import { toCoFrontingAnalytics, toFrontingAnalytics } from "../fronting-analytics.js";

import type { CoFrontingAnalytics, FrontingAnalytics } from "@pluralscape/types";
import type { CustomFrontId, MemberId, SystemId } from "@pluralscape/types";
import type { UnixMillis } from "@pluralscape/types";

const systemId = "sys_test" as SystemId;
const now = Date.now() as UnixMillis;
const memberId = "mem_abc" as MemberId;
const customFrontId = "cf_xyz" as CustomFrontId;

const rawFrontingAnalytics = {
  systemId,
  dateRange: { preset: "last-7-days" as const, start: (now - 604800000) as UnixMillis, end: now },
  subjectBreakdowns: [
    {
      subjectType: "member" as const,
      subjectId: memberId,
      totalDuration: 3600000 as ReturnType<typeof Number>,
      sessionCount: 3,
      averageSessionLength: 1200000 as ReturnType<typeof Number>,
      percentageOfTotal: 80,
    },
    {
      subjectType: "customFront" as const,
      subjectId: customFrontId,
      totalDuration: 900000 as ReturnType<typeof Number>,
      sessionCount: 1,
      averageSessionLength: 900000 as ReturnType<typeof Number>,
      percentageOfTotal: 20,
    },
  ],
  truncated: false,
} satisfies FrontingAnalytics;

const rawCoFrontingAnalytics = {
  systemId,
  dateRange: { preset: "last-30-days" as const, start: (now - 2592000000) as UnixMillis, end: now },
  coFrontingPercentage: 25,
  pairs: [
    {
      memberA: "mem_a" as MemberId,
      memberB: "mem_b" as MemberId,
      totalDuration: 1800000 as ReturnType<typeof Number>,
      sessionCount: 2,
      percentageOfTotal: 25,
    },
  ],
  truncated: false,
} satisfies CoFrontingAnalytics;

describe("toFrontingAnalytics", () => {
  it("passes through a valid FrontingAnalytics object", () => {
    const result = toFrontingAnalytics(rawFrontingAnalytics);
    expect(result).toEqual(rawFrontingAnalytics);
  });

  it("preserves systemId", () => {
    const result = toFrontingAnalytics(rawFrontingAnalytics);
    expect(result.systemId).toBe(systemId);
  });

  it("preserves dateRange fields", () => {
    const result = toFrontingAnalytics(rawFrontingAnalytics);
    expect(result.dateRange.preset).toBe("last-7-days");
    expect(result.dateRange.start).toBe(rawFrontingAnalytics.dateRange.start);
    expect(result.dateRange.end).toBe(now);
  });

  it("preserves subjectBreakdowns array", () => {
    const result = toFrontingAnalytics(rawFrontingAnalytics);
    expect(result.subjectBreakdowns).toHaveLength(2);
    expect(result.subjectBreakdowns[0]).toEqual(rawFrontingAnalytics.subjectBreakdowns[0]);
    expect(result.subjectBreakdowns[1]).toEqual(rawFrontingAnalytics.subjectBreakdowns[1]);
  });

  it("preserves truncated flag", () => {
    const result = toFrontingAnalytics({ ...rawFrontingAnalytics, truncated: true });
    expect(result.truncated).toBe(true);
  });

  it("returns empty subjectBreakdowns when none present", () => {
    const result = toFrontingAnalytics({ ...rawFrontingAnalytics, subjectBreakdowns: [] });
    expect(result.subjectBreakdowns).toHaveLength(0);
  });

  it("preserves null preset in dateRange", () => {
    const result = toFrontingAnalytics({
      ...rawFrontingAnalytics,
      dateRange: { preset: null, start: rawFrontingAnalytics.dateRange.start, end: now },
    });
    expect(result.dateRange.preset).toBeNull();
  });
});

describe("toCoFrontingAnalytics", () => {
  it("passes through a valid CoFrontingAnalytics object", () => {
    const result = toCoFrontingAnalytics(rawCoFrontingAnalytics);
    expect(result).toEqual(rawCoFrontingAnalytics);
  });

  it("preserves systemId", () => {
    const result = toCoFrontingAnalytics(rawCoFrontingAnalytics);
    expect(result.systemId).toBe(systemId);
  });

  it("preserves coFrontingPercentage", () => {
    const result = toCoFrontingAnalytics(rawCoFrontingAnalytics);
    expect(result.coFrontingPercentage).toBe(25);
  });

  it("preserves pairs array", () => {
    const result = toCoFrontingAnalytics(rawCoFrontingAnalytics);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toEqual(rawCoFrontingAnalytics.pairs[0]);
  });

  it("preserves truncated flag", () => {
    const result = toCoFrontingAnalytics({ ...rawCoFrontingAnalytics, truncated: true });
    expect(result.truncated).toBe(true);
  });

  it("returns empty pairs when none present", () => {
    const result = toCoFrontingAnalytics({ ...rawCoFrontingAnalytics, pairs: [] });
    expect(result.pairs).toHaveLength(0);
  });

  it("coFrontingPercentage is 0 when no co-fronting occurred", () => {
    const result = toCoFrontingAnalytics({ ...rawCoFrontingAnalytics, coFrontingPercentage: 0 });
    expect(result.coFrontingPercentage).toBe(0);
  });
});
