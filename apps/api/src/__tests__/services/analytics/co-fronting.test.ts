/**
 * Unit tests for analytics/co-fronting.ts (computeCoFrontingBreakdown).
 *
 * Covers: ownership guard, overlap detection, canonical pair ordering,
 * percentage calculation, open sessions, filtering, edge-case branches,
 * truncation, all-time preset.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, NOW, SYSTEM_ID, makeSessionRow, makeDateRange, memberSession } from "./internal.js";

import type { DateRangeFilter } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { computeCoFrontingBreakdown } = await import("../../../services/analytics/co-fronting.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

afterEach(() => {
  vi.restoreAllMocks();
});

// ── computeCoFrontingBreakdown ────────────────────────────────────────

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
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW - 3_600_000),
      memberSession("fs_2", "mem_b", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("detects overlapping sessions between two members", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 14_400_000, NOW),
      memberSession("fs_2", "mem_b", NOW - 7_200_000, NOW + 7_200_000),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({ memberA: "mem_a", memberB: "mem_b", sessionCount: 1 });
    expect(result.pairs[0]?.totalDuration).toBe(7_200_000);
  });

  it("uses canonical pair ordering (lexicographic)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_z", NOW - 7_200_000, NOW),
      memberSession("fs_2", "mem_a", NOW - 7_200_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs[0]?.memberA).toBe("mem_a");
    expect(result.pairs[0]?.memberB).toBe("mem_z");
  });

  it("calculates coFrontingPercentage correctly", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 14_400_000, NOW - 7_200_000),
      memberSession("fs_2", "mem_b", NOW - 10_800_000, NOW - 3_600_000),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.coFrontingPercentage).toBeCloseTo(33.3, 1);
  });

  it("handles open sessions in co-fronting", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, null),
      memberSession("fs_2", "mem_b", NOW - 3_600_000, null),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.totalDuration).toBeGreaterThanOrEqual(3_599_000);
  });

  it("excludes custom fronts from co-fronting pairs", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: "cf_test",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
  });

  it("produces 3 pairs for 3 overlapping members", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW),
      memberSession("fs_2", "mem_b", NOW - 7_200_000, NOW),
      memberSession("fs_3", "mem_c", NOW - 7_200_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(3);
    const pairKeys = result.pairs.map(
      (p: { memberA: string; memberB: string }) => `${p.memberA}:${p.memberB}`,
    );
    expect(pairKeys).toContain("mem_a:mem_b");
    expect(pairKeys).toContain("mem_a:mem_c");
    expect(pairKeys).toContain("mem_b:mem_c");
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
    chain.limit.mockResolvedValueOnce([
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
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
  });

  it("handles two sessions with identical start and end times", async () => {
    const { db, chain } = mockDb();
    const start = NOW - 3_600_000;
    const end = NOW;
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", start, end),
      memberSession("fs_2", "mem_b", start, end),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.totalDuration).toBe(3_600_000);
    expect(result.coFrontingPercentage).toBeCloseTo(100, 1);
  });

  it("computes percentageOfTotal per pair correctly", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 14_400_000, NOW),
      memberSession("fs_2", "mem_b", NOW - 7_200_000, NOW),
      memberSession("fs_3", "mem_c", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(3);
    const pairAB = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_a" && p.memberB === "mem_b",
    );
    const pairAC = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_a" && p.memberB === "mem_c",
    );
    const pairBC = result.pairs.find(
      (p: { memberA: string; memberB: string }) => p.memberA === "mem_b" && p.memberB === "mem_c",
    );
    expect(pairAB?.percentageOfTotal).toBeCloseTo(50, 1);
    expect(pairAC?.percentageOfTotal).toBeCloseTo(25, 1);
    expect(pairBC?.percentageOfTotal).toBeCloseTo(25, 1);
    expect(result.coFrontingPercentage).toBeCloseTo(50, 1);
  });

  it("skips same-member session pairs", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW),
      memberSession("fs_2", "mem_a", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
  });

  it("skips sessions that clamp to zero duration outside the date range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      start: (NOW - 7_200_000) as DateRangeFilter["start"],
      end: NOW as DateRangeFilter["end"],
    });
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW),
      memberSession("fs_2", "mem_b", NOW - 86_400_000, NOW - 82_800_000),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);
    expect(result.pairs).toEqual([]);
  });

  it("accumulates sessionCount across multiple overlapping session records", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_a1", "mem_a", NOW - 28_800_000, NOW - 21_600_000),
      memberSession("fs_a2", "mem_a", NOW - 14_400_000, NOW - 7_200_000),
      memberSession("fs_b1", "mem_b", NOW - 25_200_000, NOW - 18_000_000),
      memberSession("fs_b2", "mem_b", NOW - 10_800_000, NOW - 3_600_000),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.sessionCount).toBe(2);
    expect(result.pairs[0]?.totalDuration).toBe(7_200_000);
  });
});

// ── Edge-case branches ────────────────────────────────────────────────

describe("computeCoFrontingBreakdown — edge-case branches", () => {
  it("skips zero-duration member sessions in pair and sweep computation", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_zero", "mem_a", NOW - 3_600_000, NOW - 3_600_000),
      memberSession("fs_normal", "mem_b", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("breaks early when sorted sessions touch at boundary without overlapping", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 7_200_000, NOW - 3_600_000),
      memberSession("fs_2", "mem_b", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("handles single member session with no possible pair", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_solo", "mem_lonely", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
    expect(result.coFrontingPercentage).toBe(0);
  });

  it("skips zero-duration session B inside inner loop", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_a", "mem_a", NOW - 7_200_000, NOW),
      memberSession("fs_b_zero", "mem_b", NOW - 5_000_000, NOW - 5_000_000),
      memberSession("fs_c", "mem_c", NOW - 3_600_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.memberA).toBe("mem_a");
    expect(result.pairs[0]?.memberB).toBe("mem_c");
    expect(result.pairs[0]?.totalDuration).toBe(3_600_000);
  });

  it("returns 0 coFrontingPercentage when all member sessions have zero duration", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 3_600_000, NOW - 3_600_000),
      memberSession("fs_2", "mem_b", NOW - 1_800_000, NOW - 1_800_000),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.pairs).toEqual([]);
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
    chain.limit.mockResolvedValueOnce([
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
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    // After clamping: A = [rangeStart, rangeStart] → zero duration, B = [rangeStart, NOW]
    // A is skipped as zero-duration; no overlap pair
    expect(result.pairs).toEqual([]);
  });

  it("applies all-time preset to co-fronting getClampedBounds without clamping", async () => {
    const { db, chain } = mockDb();
    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: (NOW - 100_000) as DateRangeFilter["start"],
      end: (NOW - 50_000) as DateRangeFilter["end"],
    };
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", NOW - 1_000_000, NOW),
      memberSession("fs_2", "mem_b", NOW - 500_000, NOW),
    ]);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.totalDuration).toBe(500_000);
    expect(result.coFrontingPercentage).toBe(50);
  });
});

// ── All-time preset ───────────────────────────────────────────────────

describe("computeCoFrontingBreakdown — all-time preset", () => {
  it("computes overlaps without date clamping for all-time preset", async () => {
    const { db, chain } = mockDb();
    const longAgo = NOW - 365 * 24 * 3_600_000;
    chain.limit.mockResolvedValueOnce([
      memberSession("fs_1", "mem_a", longAgo, NOW),
      memberSession("fs_2", "mem_b", longAgo, NOW),
    ]);

    const allTimeRange: DateRangeFilter = {
      preset: "all-time",
      start: 0 as DateRangeFilter["start"],
      end: 0 as DateRangeFilter["end"],
    };
    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, allTimeRange);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.totalDuration).toBeGreaterThan(300 * 24 * 3_600_000);
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
    expect(result.pairs).toEqual([]);
  });
});

// ── Truncation ────────────────────────────────────────────────────────

describe("analytics truncation", () => {
  it("returns truncated: true when session count hits the limit", async () => {
    const { db, chain } = mockDb();
    // The fronting breakdown truncation test is in fronting.test.ts;
    // this covers the co-fronting row-count path.
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      makeSessionRow({ id: `fs_session-${String(i)}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeCoFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());
    expect(result.truncated).toBe(true);
  });
});
