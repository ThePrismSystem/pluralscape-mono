import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
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

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

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
  });

  it("computes breakdown for a single member session", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({ startTime: NOW - 3_600_000, endTime: NOW });
    chain.limit.mockResolvedValueOnce([row]);

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
  });

  it("caps open sessions at current time", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({ startTime: NOW - 7_200_000, endTime: null });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    // Duration should be approximately 7200000 (allow for test execution time)
    expect(result.subjectBreakdowns[0]?.totalDuration).toBeGreaterThanOrEqual(7_199_000);
  });

  it("aggregates multiple sessions for the same member", async () => {
    const { db, chain } = mockDb();
    const row1 = makeSessionRow({
      id: "fs_session-1",
      startTime: NOW - 7_200_000,
      endTime: NOW - 3_600_000,
    });
    const row2 = makeSessionRow({
      id: "fs_session-2",
      startTime: NOW - 1_800_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row1, row2]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      subjectType: "member",
      subjectId: "mem_test-member",
      totalDuration: 5_400_000, // 3600000 + 1800000
      sessionCount: 2,
      averageSessionLength: 2_700_000,
    });
  });

  it("includes custom fronts with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({
      memberId: null,
      customFrontId: "cf_test-cf",
      startTime: NOW - 1_800_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]).toMatchObject({
      subjectType: "customFront",
      subjectId: "cf_test-cf",
    });
  });

  it("includes structure entities with subjectType discriminator", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({
      memberId: null,
      structureEntityId: "ste_test-entity",
      startTime: NOW - 1_800_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row]);

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
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_a",
        startTime: NOW - 10_800_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: "cf_b",
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    const member = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_a",
    );
    const cf = result.subjectBreakdowns.find((b: { subjectId: string }) => b.subjectId === "cf_b");
    expect(member?.percentageOfTotal).toBe(75);
    expect(cf?.percentageOfTotal).toBe(25);
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
  });

  it("calculates coFrontingPercentage correctly", async () => {
    const { db, chain } = mockDb();
    // Only member sessions overlap. Total fronting time = union of all sessions.
    // A: 0-4h, B: 2-6h. Total union = 6h. Co-fronting = 2h. Percentage = 2/6*100 = 33.33...
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

    expect(result.coFrontingPercentage).toBeGreaterThan(0);
    expect(result.pairs).toHaveLength(1);
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
  });
});
