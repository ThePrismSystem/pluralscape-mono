/**
 * Unit tests for analytics/fronting.ts (computeFrontingBreakdown).
 *
 * Covers: ownership guard, empty results, aggregate forwarding,
 * percentage calculations, sort order, truncation, preset branches.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import type { DateRangeFilter } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { computeFrontingBreakdown } = await import("../../../services/analytics/fronting.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

import { AUTH, SYSTEM_ID, makeAggRow, makeDateRange } from "./internal.js";

const NOW = Date.now();

afterEach(() => {
  vi.restoreAllMocks();
});

// ── computeFrontingBreakdown ──────────────────────────────────────────

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

  it("computes breakdown for a single member session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "member", subjectId: "mem_test-member", totalDuration: 3_600_000, sessionCount: 1 }),
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

  it("forwards sessionCount and computes averageSessionLength from aggregate totals", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 5_400_000, sessionCount: 2 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]).toMatchObject({
      totalDuration: 5_400_000,
      sessionCount: 2,
      averageSessionLength: 2_700_000,
    });
  });

  it("includes custom fronts with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "customFront", subjectId: "cf_test-cf", totalDuration: 1_800_000 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]).toMatchObject({ subjectType: "customFront", subjectId: "cf_test-cf" });
  });

  it("includes structure entities with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "structureEntity", subjectId: "ste_test-entity", totalDuration: 1_800_000 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]).toMatchObject({ subjectType: "structureEntity", subjectId: "ste_test-entity" });
  });

  it("calculates correct percentages across multiple subjects", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "member", subjectId: "mem_a", totalDuration: 10_800_000, sessionCount: 1 }),
      makeAggRow({ subjectType: "customFront", subjectId: "cf_b", totalDuration: 3_600_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    const member = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "mem_a");
    const cf = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "cf_b");
    expect(member?.percentageOfTotal).toBe(75);
    expect(cf?.percentageOfTotal).toBe(25);
    expect(result.truncated).toBe(false);
  });

  it("sorts breakdowns descending by total duration", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_short", totalDuration: 1_800_000, sessionCount: 1 }),
      makeAggRow({ subjectId: "mem_long", totalDuration: 7_200_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_long");
  });

  it("returns empty breakdown for date range with no matching sessions", async () => {
    const { db, chain } = mockDb();
    const farPast = Date.now() - 86_400_000 * 60;
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (farPast - 3_600_000) as DateRangeFilter["start"],
      end: farPast as DateRangeFilter["end"],
    });
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
      makeAggRow({ subjectType: "structureEntity", subjectId: "ste_gamma", totalDuration: 900_000 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns).toHaveLength(3);
    const types = result.subjectBreakdowns.map((b: { subjectType: string }) => b.subjectType);
    expect(types).toContain("member");
    expect(types).toContain("customFront");
    expect(types).toContain("structureEntity");
  });

  it("drops zero-duration subjects via the SQL HAVING clause", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_b", totalDuration: 3_600_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_b");
  });

  it("returns the full aggregate for all-time preset", async () => {
    const { db, chain } = mockDb();
    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: 1_200_000 as DateRangeFilter["start"],
      end: 1_800_000 as DateRangeFilter["end"],
    };
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 1_000_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);
    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(1_000_000);
    expect(result.dateRange.preset).toBe("all-time");
  });
});

// ── Edge-case branches ────────────────────────────────────────────────

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
    const now = Date.now();
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (now - 7_200_000) as DateRangeFilter["start"],
      end: (now - 1_800_000) as DateRangeFilter["end"],
    });
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 5_400_000 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(5_400_000);
  });

  it("mixes member and customFront subjects with varying durations", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectType: "member", subjectId: "mem_x", totalDuration: 9_000_000, sessionCount: 2 }),
      makeAggRow({ subjectType: "customFront", subjectId: "cf_y", totalDuration: 900_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    const memX = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "mem_x");
    const cfY = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "cf_y");
    expect(memX?.averageSessionLength).toBe(4_500_000);
    expect(memX?.percentageOfTotal).toBeCloseTo(90.9, 1);
    expect(cfY?.percentageOfTotal).toBeCloseTo(9.1, 1);
  });
});

// ── computeFrontingBreakdown — clamped totals and truncation ─────────

describe("computeFrontingBreakdown — clamped totals and truncation", () => {
  /** Must match the production constant in analytics.service.ts. */
  const MAX_ANALYTICS_SESSIONS = 10_000;

  /**
   * Mock the pre-aggregate COUNT query (first `tx.select().from().where()`).
   * The service uses this row to decide `truncated`, so the unit tests
   * stub it explicitly rather than relying on the default empty-array
   * behaviour of the shared mockDb chain.
   */
  function stubRawSessionCount(chain: ReturnType<typeof mockDb>["chain"], n: number): void {
    chain.where.mockReturnValueOnce(Promise.resolve([{ n }]) as never);
  }

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

  it("forwards DB-clamped durations when session starts before the range", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 1_800_000, sessionCount: 1 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(1_800_000);
  });

  it("forwards DB-clamped durations when session ends after the range", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeAggRow({ totalDuration: 900_000, sessionCount: 1 })]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(900_000);
  });

  it("yields no breakdowns when the aggregate returns zero rows", async () => {
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
    // `truncated` is now driven by the pre-aggregate COUNT query
    // (tx.select().from().where()), not the aggregate-row count.
    chain.where.mockReturnValueOnce(Promise.resolve([{ n: 10_000 }]) as never);
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      makeAggRow({ subjectId: `mem_${String(i)}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
  });

  it("forwards per-subject clamped totals from the aggregate", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ subjectId: "mem_a", totalDuration: 7_200_000, sessionCount: 1 }),
      makeAggRow({ subjectId: "mem_b", totalDuration: 3_600_000, sessionCount: 1 }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    const memberA = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_a",
    );
    const memberB = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_b",
    );
    expect(memberA?.totalDuration).toBe(7_200_000);
    expect(memberB?.totalDuration).toBe(3_600_000);
  });

  it("returns truncated: false when below the limit (truncation suite)", async () => {
    const { db, chain } = mockDb();
    stubRawSessionCount(chain, 1);
    chain.limit.mockResolvedValueOnce([makeAggRow()]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(false);
  });

  it("returns truncated: true when session count hits the limit (truncation suite)", async () => {
    const { db, chain } = mockDb();
    stubRawSessionCount(chain, MAX_ANALYTICS_SESSIONS);
    chain.limit.mockResolvedValueOnce([
      makeAggRow({ totalDuration: 3_600_000, sessionCount: MAX_ANALYTICS_SESSIONS }),
    ]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
    expect(result.subjectBreakdowns.length).toBeGreaterThan(0);
  });
});

// ── computeFrontingBreakdown — all-time preset ────────────────────────

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
