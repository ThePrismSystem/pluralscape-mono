/**
 * Shared fixture builders for analytics test files.
 * Used by fronting.test.ts, co-fronting.test.ts, and truncation.test.ts.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { DateRangeFilter, SystemId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const NOW = Date.now();

export const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

export function makeDateRange(overrides?: Partial<DateRangeFilter>): DateRangeFilter {
  return {
    preset: "last-30-days",
    start: (NOW - 30 * 24 * 60 * 60 * 1000) as DateRangeFilter["start"],
    end: NOW as DateRangeFilter["end"],
    ...overrides,
  };
}

export function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fs_test-session",
    systemId: SYSTEM_ID,
    memberId: "mem_test-member",
    customFrontId: null,
    structureEntityId: null,
    startTime: NOW - 3_600_000,
    endTime: NOW,
    archived: false,
    ...overrides,
  };
}

/**
 * Aggregated-row shape returned by the SQL GROUP BY in aggregateSubjectBreakdown.
 * Unit tests that drive computeFrontingBreakdown stub the chain to return these
 * directly so the JS post-aggregation math is still exercised.
 */
export function makeAggRow(
  overrides: Partial<{
    subjectType: "member" | "customFront" | "structureEntity";
    subjectId: string;
    totalDuration: number;
    sessionCount: number;
  }> = {},
): Record<string, unknown> {
  return {
    subjectType: "member",
    subjectId: "mem_test-member",
    totalDuration: 3_600_000,
    sessionCount: 1,
    ...overrides,
  };
}
