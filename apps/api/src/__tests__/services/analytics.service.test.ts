import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { DateRangeFilter, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { computeFrontingBreakdown, computeCoFrontingBreakdown } =
  await import("../../services/analytics.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const NOW = Date.now();

function makeDateRange(overrides?: Partial<DateRangeFilter>): DateRangeFilter {
  return {
    preset: "last-30-days",
    start: (NOW - 30 * 24 * 60 * 60 * 1000) as DateRangeFilter["start"],
    end: NOW as DateRangeFilter["end"],
    ...overrides,
  };
}

function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fs_test-session",
    systemId: SYSTEM_ID,
    memberId: "mem_test-member",
    customFrontId: null,
    structureEntityId: null,
    startTime: NOW - 3_600_000, // 1 hour ago
    endTime: NOW,
    archived: false,
    ...overrides,
  };
}

/**
 * Aggregated-row shape returned by the SQL GROUP BY in
 * aggregateSubjectBreakdown. Unit tests that drive computeFrontingBreakdown
 * stub the chain to return these directly so the math the service does in
 * JS after the aggregate (percentage-of-total, averageSessionLength) is
 * still exercised.
 */
function makeAggRow(
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

afterEach(() => {
  vi.restoreAllMocks();
});

// ── computeFrontingBreakdown ─────────────────────────────────────────

describe("computeFrontingBreakdown", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange())).rejects.toThrow(
      "System not found",
    );
  });

  it("returns empty breakdowns when no sessions exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  // After api-njhu, computeFrontingBreakdown aggregates in SQL, so these
  // unit tests drive the post-aggregation math (percentage-of-total,
  // averageSessionLength, branding) by stubbing aggregated rows directly.
  // The SQL itself is covered by analytics.service.integration.test.ts.
  it("computes breakdown for a single member session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({
        subjectType: "member",
        subjectId: "mem_test-member",
        totalDuration: 3_600_000,
        sessionCount: 1,
      }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      subjectType: "member",
      subjectId: "mem_test-member",
      totalDuration: 3_600_000,
      sessionCount: 1,
      averageSessionLength: 3_600_000,
      percentageOfTotal: 100,
    });
    expect(result.truncated).toBe(false);
  });

  it("surfaces open-session clamping via the DB's clamped duration", async () => {
    const { db, chain } = mockDb();
    // The SQL layer clamps to NOW() for open sessions. In the unit test we
    // just trust that contract and assert the service forwards the value.
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 7_200_000, sessionCount: 1 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(7_200_000);
    expect(result.truncated).toBe(false);
  });

  it("forwards sessionCount and computes averageSessionLength from aggregate totals", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 5_400_000, sessionCount: 2 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      totalDuration: 5_400_000,
      sessionCount: 2,
      averageSessionLength: 2_700_000,
    });
    expect(result.truncated).toBe(false);
  });

  it("includes custom fronts with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "customFront", subjectId: "cf_test-cf", totalDuration: 1_800_000 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      subjectType: "customFront",
      subjectId: "cf_test-cf",
    });
  });

  it("includes structure entities with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({
        subjectType: "structureEntity",
        subjectId: "ste_test-entity",
        totalDuration: 1_800_000,
      }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      subjectType: "structureEntity",
      subjectId: "ste_test-entity",
    });
  });

  it("calculates correct percentages across multiple subjects", async () => {
    const { db, chain } = mockDb();
    // Member: 3 hours, Custom Front: 1 hour = 75% / 25%
    chain.limit.mockResolvedValueOnce([
      makeAggRow({
        subjectType: "member",
        subjectId: "mem_a",
        totalDuration: 10_800_000,
        sessionCount: 1,
      }),
      makeAggRow({
        subjectType: "customFront",
        subjectId: "cf_b",
        totalDuration: 3_600_000,
        sessionCount: 1,
      }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    const member = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_a",
    );
    const cf = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "cf_b");
    expect(member?.percentageOfTotal).toBe(75);
    expect(cf?.percentageOfTotal).toBe(25);
    expect(result.truncated).toBe(false);
  });

  it("forwards DB-clamped durations when session starts before the range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (NOW - 3_600_000) as DateRangeFilter["start"],
      end: NOW as DateRangeFilter["end"],
    });
    // The clamping happens in SQL via GREATEST(startTime, rangeStart); we
    // simulate the post-clamp total here.
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 3_600_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(3_600_000);
    expect(result.truncated).toBe(false);
  });

  it("forwards DB-clamped durations when session ends after the range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (NOW - 7_200_000) as DateRangeFilter["start"],
      end: (NOW - 3_600_000) as DateRangeFilter["end"],
    });
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 3_600_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(3_600_000);
    expect(result.truncated).toBe(false);
  });

  it("yields no breakdowns when the aggregate returns zero rows", async () => {
    // Rows with no subject are filtered out at the SQL layer via the
    // HAVING clause; an empty result reaches the service here.
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("returns truncated=false when under cap", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAggRow()]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(false);
  });

  it("returns truncated=true when at session cap", async () => {
    const { db, chain } = mockDb();
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      makeAggRow({ subjectId: `mem_${String(i)}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
  });

  it("sorts breakdowns descending by total duration", async () => {
    const { db, chain } = mockDb();
    // The SQL ORDER BY already sorts desc; the service resorts defensively
    // after branding. Feed rows in ascending order to prove the service
    // still produces a descending result.
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_short", totalDuration: 1_800_000, sessionCount: 1 }),
      makeAggRow({ subjectId: "mem_long", totalDuration: 7_200_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    expect(
      (result.subjectBreakdowns[0]?.totalDuration as number) >=
        (result.subjectBreakdowns[1]?.totalDuration as number),
    ).toBe(true);
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_long");
    expect(result.truncated).toBe(false);
  });

  it("forwards per-subject clamped totals from the aggregate", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_a", totalDuration: 7_200_000, sessionCount: 1 }),
      makeAggRow({ subjectId: "mem_b", totalDuration: 3_600_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    const memberA = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_a",
    );
    const memberB = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_b",
    );
    expect(memberA?.totalDuration).toBe(7_200_000);
    expect(memberB?.totalDuration).toBe(3_600_000);
  });

  it("returns empty breakdown for date range with no matching sessions", async () => {
    const { db, chain } = mockDb();
    // Session exists but is entirely outside the custom date range
    const farPast = NOW - 86_400_000 * 60; // 60 days ago
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (farPast - 3_600_000) as DateRangeFilter["start"],
      end: farPast as DateRangeFilter["end"],
    });
    // DB returns no sessions for this range
    chain.limit.mockResolvedValueOnce([]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toEqual([]);
    expect(result.dateRange).toBe(dateRange);
  });

  it("includes member, customFront, and structureEntity in flat breakdown array", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "member", subjectId: "mem_alpha", totalDuration: 3_600_000 }),
      makeAggRow({ subjectType: "customFront", subjectId: "cf_beta", totalDuration: 1_800_000 }),
      makeAggRow({
        subjectType: "structureEntity",
        subjectId: "ste_gamma",
        totalDuration: 900_000,
      }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(3);
    const types = result.subjectBreakdowns.map((b: { subjectType: string }) => b.subjectType);
    expect(types).toContain("member");
    expect(types).toContain("customFront");
    expect(types).toContain("structureEntity");
    // Verify each subject resolved to the correct type (sort tested separately)
    const member = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_alpha",
    );
    const custom = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "cf_beta",
    );
    const entity = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "ste_gamma",
    );
    expect(member?.subjectType).toBe("member");
    expect(custom?.subjectType).toBe("customFront");
    expect(entity?.subjectType).toBe("structureEntity");
  });

  it("returns the full aggregate for all-time preset", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "all-time" as DateRangeFilter["preset"],
      start: 1_200_000 as DateRangeFilter["start"],
      end: 1_800_000 as DateRangeFilter["end"],
    });
    // In all-time mode the SQL layer does not clamp — the aggregate
    // returns the full session duration.
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 1_000_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(1_000_000);
    expect(result.dateRange.preset).toBe("all-time");
  });

  it("drops zero-duration subjects via the SQL HAVING clause", async () => {
    const { db, chain } = mockDb();
    // Zero-duration rows are filtered by HAVING SUM(...) > 0 in SQL; the
    // aggregate shape reaching the service contains only non-zero entries.
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_b", totalDuration: 3_600_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_b");
    expect(result.truncated).toBe(false);
  });
});

// ── computeCoFrontingBreakdown ───────────────────────────────────────

describe("computeCoFrontingBreakdown", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange())).rejects.toThrow(
      "System not found",
    );
  });

  it("returns empty when no sessions exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("returns empty when there is no overlap", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW - 3_600_000,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("detects overlapping sessions between two members", async () => {
    const { db, chain } = mockDb();
    // Member A: 0-4h, Member B: 2-6h → overlap 2h
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 14_400_000, // 4h ago
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 7_200_000, // 2h ago
        endTime: NOW + 7_200_000,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({
      memberA: "mem_a",
      memberB: "mem_b",
      sessionCount: 1,
    });
    // Overlap duration should be 2h (7200000ms)
    expect(result.pairs[0]?.totalDuration).toBe(7_200_000);
    expect(result.truncated).toBe(false);
  });

  it("uses canonical pair ordering (lexicographic)", async () => {
    const { db, chain } = mockDb();
    // mem_z before mem_a in session list, but should be ordered as mem_a, mem_z in pair
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_z",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.memberA).toBe("mem_a");
    expect(result.pairs[0]?.memberB).toBe("mem_z");
    expect(result.truncated).toBe(false);
  });

  it("calculates coFrontingPercentage correctly", async () => {
    const { db, chain } = mockDb();
    // A: 4h ago → 2h ago (2h duration), B: 3h ago → 1h ago (2h duration)
    // Sweep-line: union = 3h (4h ago → 1h ago), co-fronting = 1h (3h ago → 2h ago)
    // Percentage = round(1/3 * 1000) / 10 = 33.3
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 14_400_000,
        endTime: NOW - 7_200_000,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 10_800_000,
        endTime: NOW - 3_600_000,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.coFrontingPercentage).toBeCloseTo(33.3, 1);
    expect(result.pairs).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it("handles open sessions in co-fronting", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: null,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 3_600_000,
        endTime: null,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(1);
    // Overlap should be approximately 1 hour (from mem_b start until now)
    expect(result.pairs[0]?.totalDuration).toBeGreaterThanOrEqual(3_599_000);
    expect(result.truncated).toBe(false);
  });

  it("excludes custom fronts from co-fronting pairs", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: "cf_test",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // Custom fronts don't count as co-fronting — only member-to-member pairs
    expect(result.pairs).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("produces 3 pairs for 3 overlapping members", async () => {
    const { db, chain } = mockDb();
    // All three members overlap the same window
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_3",
        memberId: "mem_c",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // 3 members → C(3,2) = 3 pairs: A-B, A-C, B-C
    expect(result.pairs).toHaveLength(3);
    const pairKeys = result.pairs.map(
      (p: { memberA: string; memberB: string }) => `${p.memberA}:${p.memberB}`,
    );
    expect(pairKeys).toContain("mem_a:mem_b");
    expect(pairKeys).toContain("mem_a:mem_c");
    expect(pairKeys).toContain("mem_b:mem_c");
    expect(result.truncated).toBe(false);
  });

  it("returns truncated flag", { timeout: 15_000 }, async () => {
    const { db, chain } = mockDb();
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      makeSessionRow({ id: `fs_session-${String(i)}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
  });

  it("excludes structure entity sessions from co-fronting pairs", async () => {
    const { db, chain } = mockDb();
    // One member session, one structure entity session — should produce no pairs
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        customFrontId: null,
        structureEntityId: null,
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: null,
        structureEntityId: "ste_entity",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // Structure entity sessions are filtered out (memberId is null)
    expect(result.pairs).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("handles two sessions with identical start and end times", async () => {
    const { db, chain } = mockDb();
    const start = NOW - 3_600_000;
    const end = NOW;
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: start,
        endTime: end,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: start,
        endTime: end,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(1);
    // Overlap is the entire duration since time ranges are identical
    expect(result.pairs[0]?.totalDuration).toBe(3_600_000);
    expect(result.pairs[0]?.memberA).toBe("mem_a");
    expect(result.pairs[0]?.memberB).toBe("mem_b");
    // 100% co-fronting since the union equals the overlap
    expect(result.coFrontingPercentage).toBeCloseTo(100, 1);
    expect(result.truncated).toBe(false);
  });

  it("computes percentageOfTotal per pair correctly", async () => {
    const { db, chain } = mockDb();
    // A: 4h window, B: 2h overlap with A, C: 1h overlap with A
    // Union covers 4h, co-fronting portion includes B (2h) and C (1h) overlap windows
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 14_400_000, // 4h ago
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 7_200_000, // 2h ago
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_3",
        memberId: "mem_c",
        startTime: NOW - 3_600_000, // 1h ago
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(3);
    // Union = 4h (A covers entire span), so percentages relative to 14_400_000
    const pairAB = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_a" && p.memberB === "mem_b",
    );
    const pairAC = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_a" && p.memberB === "mem_c",
    );
    const pairBC = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_b" && p.memberB === "mem_c",
    );
    // A-B overlap: 2h / 4h union = 50%, A-C: 1h / 4h = 25%, B-C: 1h / 4h = 25%
    expect(pairAB?.percentageOfTotal).toBeCloseTo(50, 1);
    expect(pairAC?.percentageOfTotal).toBeCloseTo(25, 1);
    expect(pairBC?.percentageOfTotal).toBeCloseTo(25, 1);
    expect(result.coFrontingPercentage).toBeCloseTo(50, 1);
    expect(result.truncated).toBe(false);
  });

  it("skips same-member session pairs", async () => {
    const { db, chain } = mockDb();
    // Two sessions from the same member should not produce a co-fronting pair
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_a",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("skips sessions that clamp to zero duration outside the date range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      start: (NOW - 7_200_000) as DateRangeFilter["start"],
      end: NOW as DateRangeFilter["end"],
    });
    // Session A is within range, session B ended before range start
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 86_400_000, // 24h ago
        endTime: NOW - 82_800_000, // 23h ago — entirely before range
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    // Session B is clamped to zero duration, so no pair is produced
    expect(result.pairs).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("accumulates sessionCount across multiple overlapping session records", async () => {
    const { db, chain } = mockDb();
    // Two members each with two non-overlapping sessions that cross-overlap
    const rows = [
      makeSessionRow({
        id: "fs_a1",
        memberId: "mem_a",
        startTime: NOW - 28_800_000, // 8h ago
        endTime: NOW - 21_600_000, // 6h ago
      }),
      makeSessionRow({
        id: "fs_a2",
        memberId: "mem_a",
        startTime: NOW - 14_400_000, // 4h ago
        endTime: NOW - 7_200_000, // 2h ago
      }),
      makeSessionRow({
        id: "fs_b1",
        memberId: "mem_b",
        startTime: NOW - 25_200_000, // 7h ago
        endTime: NOW - 18_000_000, // 5h ago
      }),
      makeSessionRow({
        id: "fs_b2",
        memberId: "mem_b",
        startTime: NOW - 10_800_000, // 3h ago
        endTime: NOW - 3_600_000, // 1h ago
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toHaveLength(1);
    // A1-B1 overlap: (7h..6h) = 1h, A2-B2 overlap: (3h..2h) = 1h → 2 sessions, 2h total
    expect(result.pairs[0]?.sessionCount).toBe(2);
    expect(result.pairs[0]?.totalDuration).toBe(7_200_000);
    expect(result.truncated).toBe(false);
  });
});

// ── Truncation ───────────────────────────────────────────────────────

describe("analytics truncation", () => {
  /** Must match the production constant in analytics.service.ts. */
  const MAX_ANALYTICS_SESSIONS = 10_000;

  it("returns truncated: true when session count hits the limit", async () => {
    const { db, chain } = mockDb();
    const sessions = Array.from({ length: MAX_ANALYTICS_SESSIONS }, (_, i) =>
      makeSessionRow({
        id: `fs_${String(i).padStart(36, "0")}`,
        startTime: NOW - (MAX_ANALYTICS_SESSIONS - i) * 3_600_000,
        endTime: NOW - (MAX_ANALYTICS_SESSIONS - i - 1) * 3_600_000,
      }),
    );
    chain.limit.mockResolvedValueOnce(sessions);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
    expect(result.subjectBreakdowns.length).toBeGreaterThan(0);
  });

  it("returns truncated: false when below the limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSessionRow()]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(false);
  });
});

// ── all-time preset branches ────────────────────────────────────────

describe("computeFrontingBreakdown — all-time preset", () => {
  it("does not clamp start/end for all-time preset", async () => {
    const { db, chain } = mockDb();
    // With all-time preset, the SQL emits the full session duration; the
    // service forwards it verbatim.
    const oneYearMs = 365 * 24 * 3_600_000;
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: oneYearMs })]);

    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: 0 as DateRangeFilter["start"],
      end: 0 as DateRangeFilter["end"],
    };
    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    const breakdown = result.subjectBreakdowns[0];
    expect(breakdown?.totalDuration).toBeGreaterThan(300 * 24 * 3_600_000);
  });
});

describe("computeCoFrontingBreakdown — all-time preset", () => {
  it("computes overlaps without date clamping for all-time preset", async () => {
    const { db, chain } = mockDb();
    const longAgo = NOW - 365 * 24 * 3_600_000;
    chain.limit.mockResolvedValueOnce([
      makeSessionRow({ id: "fs_1", memberId: "mem_a", startTime: longAgo, endTime: NOW }),
      makeSessionRow({ id: "fs_2", memberId: "mem_b", startTime: longAgo, endTime: NOW }),
    ]);

    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: 0 as DateRangeFilter["start"],
      end: 0 as DateRangeFilter["end"],
    };
    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);

    expect(result.pairs).toHaveLength(1);
    const pair = result.pairs[0];
    expect(pair?.totalDuration).toBeGreaterThan(300 * 24 * 3_600_000);
    expect(result.coFrontingPercentage).toBe(100);
  });

  it("returns empty pairs when only customFront sessions exist (no member pairs)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeSessionRow({
        id: "fs_1",
        memberId: null,
        customFrontId: "cf_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: "cf_b",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // Co-fronting only considers member sessions
    expect(result.pairs).toEqual([]);
  });
});

// ── Edge-case branch coverage ──────────────────────────────────────

describe("computeCoFrontingBreakdown — edge-case branches", () => {
  it("skips zero-duration member sessions in pair and sweep computation", async () => {
    const { db, chain } = mockDb();
    // Session A has zero duration (startTime === endTime), session B is normal
    // Zero-duration session should be skipped by boundsA.end <= boundsA.start guard
    const rows = [
      makeSessionRow({
        id: "fs_zero",
        memberId: "mem_a",
        startTime: NOW - 3_600_000,
        endTime: NOW - 3_600_000, // zero duration
      }),
      makeSessionRow({
        id: "fs_normal",
        memberId: "mem_b",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // Zero-duration session cannot produce overlap pairs
    expect(result.pairs).toEqual([]);
    // Only one valid session in sweep, so coFrontingPercentage is 0
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("breaks early when sorted sessions touch at boundary without overlapping", async () => {
    const { db, chain } = mockDb();
    // Session A ends exactly when B starts → no overlap after sort
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW - 3_600_000,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 3_600_000, // starts exactly at A.end
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // boundsB.start >= boundsA.end triggers break — no pair produced
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("handles single member session with no possible pair", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_solo",
        memberId: "mem_lonely",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toEqual([]);
    // Single session: union = 1h, co-fronting = 0
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("skips zero-duration session B inside inner loop", async () => {
    const { db, chain } = mockDb();
    // A is normal, B has zero duration → B is skipped by boundsB.end <= boundsB.start
    // C overlaps with A → produces one pair
    const rows = [
      makeSessionRow({
        id: "fs_a",
        memberId: "mem_a",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_b_zero",
        memberId: "mem_b",
        startTime: NOW - 5_000_000,
        endTime: NOW - 5_000_000, // zero duration
      }),
      makeSessionRow({
        id: "fs_c",
        memberId: "mem_c",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    // Only A-C pair should exist; B is zero-duration and skipped
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.memberA).toBe("mem_a");
    expect(result.pairs[0]?.memberB).toBe("mem_c");
    expect(result.pairs[0]?.totalDuration).toBe(3_600_000);
  });

  it("returns 0 coFrontingPercentage when all member sessions have zero duration", async () => {
    const { db, chain } = mockDb();
    // Both sessions are zero-duration → sweep produces no events → toOneDecimalPercent(0, 0)
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 3_600_000,
        endTime: NOW - 3_600_000,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 1_800_000,
        endTime: NOW - 1_800_000,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.pairs).toEqual([]);
    // totalFrontingUnion = 0, so toOneDecimalPercent returns 0
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("clamps co-fronting sessions to date range producing zero effective overlap", async () => {
    const { db, chain } = mockDb();
    // Both sessions overlap outside the custom date range, but inside the range they don't
    const rangeStart = NOW - 7_200_000;
    const rangeEnd = NOW;
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: rangeStart as DateRangeFilter["start"],
      end: rangeEnd as DateRangeFilter["end"],
    });
    // A ends at rangeStart after clamping, B starts at rangeStart after clamping → no overlap
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 14_400_000,
        endTime: NOW - 7_200_000, // ends exactly at range start
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 7_200_000, // starts exactly at range start
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    // After clamping: A = [rangeStart, rangeStart] → zero duration, B = [rangeStart, NOW]
    // A is skipped as zero-duration; no overlap pair
    expect(result.pairs).toEqual([]);
  });

  it("applies all-time preset to co-fronting getClampedBounds without clamping", async () => {
    const { db, chain } = mockDb();
    // Sessions that extend well beyond any nominal date range
    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: (NOW - 100_000) as DateRangeFilter["start"], // would clamp if used
      end: (NOW - 50_000) as DateRangeFilter["end"], // would clamp if used
    };
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 1_000_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: "mem_b",
        startTime: NOW - 500_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);

    expect(result.pairs).toHaveLength(1);
    // Full overlap without clamping: 500_000ms (from B.start to A.end = NOW)
    expect(result.pairs[0]?.totalDuration).toBe(500_000);
    // Union: 1_000_000 (A covers full span), co-fronting: 500_000
    expect(result.coFrontingPercentage).toBe(50);
  });
});

describe("computeFrontingBreakdown — edge-case branches", () => {
  it("uses all-time preset with open session (null endTime)", async () => {
    const { db, chain } = mockDb();
    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: 0 as DateRangeFilter["start"],
      end: 0 as DateRangeFilter["end"],
    };
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 3_600_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBeGreaterThanOrEqual(3_599_000);
  });

  it("clamps open session endTime to date range end (non-all-time)", async () => {
    const { db, chain } = mockDb();
    const rangeEnd = NOW - 1_800_000;
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (NOW - 7_200_000) as DateRangeFilter["start"],
      end: rangeEnd as DateRangeFilter["end"],
    });
    // The SQL GREATEST/LEAST clamps the open session to rangeEnd; the
    // service forwards the already-clamped value.
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 5_400_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(5_400_000);
  });

  it("mixes member and customFront subjects with varying durations", async () => {
    const { db, chain } = mockDb();
    // mem_x: 7_200_000 + 1_800_000 = 9_000_000, 2 sessions; cf_y: 900_000, 1 session
    chain.limit.mockResolvedValueOnce([
      makeAggRow({
        subjectType: "member",
        subjectId: "mem_x",
        totalDuration: 9_000_000,
        sessionCount: 2,
      }),
      makeAggRow({
        subjectType: "customFront",
        subjectId: "cf_y",
        totalDuration: 900_000,
        sessionCount: 1,
      }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    const memX = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_x",
    );
    const cfY = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "cf_y");
    expect(memX?.totalDuration).toBe(9_000_000);
    expect(memX?.sessionCount).toBe(2);
    expect(memX?.averageSessionLength).toBe(4_500_000);
    expect(cfY?.totalDuration).toBe(900_000);
    expect(cfY?.sessionCount).toBe(1);
    expect(memX?.percentageOfTotal).toBeCloseTo(90.9, 1);
    expect(cfY?.percentageOfTotal).toBeCloseTo(9.1, 1);
  });
});
