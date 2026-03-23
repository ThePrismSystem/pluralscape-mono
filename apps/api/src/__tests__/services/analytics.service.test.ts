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
    expect(result.truncated).toBe(false);
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
    expect(result.truncated).toBe(false);
  });

  it("caps open sessions at current time", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({ startTime: NOW - 7_200_000, endTime: null });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(1);
    // Duration should be approximately 7200000 (allow for test execution time)
    expect(result.subjectBreakdowns[0]?.totalDuration).toBeGreaterThanOrEqual(7_199_000);
    expect(result.truncated).toBe(false);
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
    expect(result.truncated).toBe(false);
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
    expect(result.truncated).toBe(false);
  });

  it("clamps session starting before date range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (NOW - 3_600_000) as DateRangeFilter["start"],
      end: NOW as DateRangeFilter["end"],
    });
    // Session starts 2h ago but range only starts 1h ago → clamped to 1h
    const row = makeSessionRow({
      startTime: NOW - 7_200_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(3_600_000);
    expect(result.truncated).toBe(false);
  });

  it("clamps session ending after date range", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: (NOW - 7_200_000) as DateRangeFilter["start"],
      end: (NOW - 3_600_000) as DateRangeFilter["end"],
    });
    // Session runs from 2h ago to now, but range ends 1h ago → clamped to 1h
    const row = makeSessionRow({
      startTime: NOW - 7_200_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(3_600_000);
    expect(result.truncated).toBe(false);
  });

  it("skips sessions with no subject", async () => {
    const { db, chain } = mockDb();
    const row = makeSessionRow({
      memberId: null,
      customFrontId: null,
      structureEntityId: null,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("returns truncated=false when under cap", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSessionRow()]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(false);
  });

  it("returns truncated=true when at session cap", async () => {
    const { db, chain } = mockDb();
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      makeSessionRow({ id: `fs_session-${String(i)}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.truncated).toBe(true);
  });

  it("sorts breakdowns descending by total duration", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_short",
        memberId: "mem_short",
        startTime: NOW - 1_800_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_long",
        memberId: "mem_long",
        startTime: NOW - 7_200_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    expect(
      (result.subjectBreakdowns[0]?.totalDuration as number) >=
        (result.subjectBreakdowns[1]?.totalDuration as number),
    ).toBe(true);
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_long");
    expect(result.truncated).toBe(false);
  });

  it("caps all open sessions at query time", async () => {
    const { db, chain } = mockDb();
    // Two open sessions (endTime: null) from different members
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

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(2);
    // mem_a: ~2h, mem_b: ~1h — both capped at Date.now()
    const memberA = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_a",
    );
    const memberB = result.subjectBreakdowns.find(
      (b: { subjectId: string }) => b.subjectId === "mem_b",
    );
    expect(memberA?.totalDuration).toBeGreaterThanOrEqual(7_199_000);
    expect(memberB?.totalDuration).toBeGreaterThanOrEqual(3_599_000);
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

  it("uses custom date range with explicit startDate/endDate", async () => {
    const { db, chain } = mockDb();
    const customStart = NOW - 86_400_000;
    const customEnd = NOW - 43_200_000;
    const dateRange = makeDateRange({
      preset: "custom" as DateRangeFilter["preset"],
      start: customStart as DateRangeFilter["start"],
      end: customEnd as DateRangeFilter["end"],
    });
    // Session spans across the custom range
    const row = makeSessionRow({
      startTime: NOW - 86_400_000,
      endTime: NOW,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    // Clamped to custom range: customEnd - customStart = 43_200_000 (12h)
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(43_200_000);
    expect(result.dateRange.preset).toBe("custom");
  });

  it("includes member, customFront, and structureEntity in flat breakdown array", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeSessionRow({
        id: "fs_1",
        memberId: "mem_alpha",
        customFrontId: null,
        structureEntityId: null,
        startTime: NOW - 3_600_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_2",
        memberId: null,
        customFrontId: "cf_beta",
        structureEntityId: null,
        startTime: NOW - 1_800_000,
        endTime: NOW,
      }),
      makeSessionRow({
        id: "fs_3",
        memberId: null,
        customFrontId: null,
        structureEntityId: "ste_gamma",
        startTime: NOW - 900_000,
        endTime: NOW,
      }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, makeDateRange());

    expect(result.subjectBreakdowns).toHaveLength(3);
    const types = result.subjectBreakdowns.map((b: { subjectType: string }) => b.subjectType);
    expect(types).toContain("member");
    expect(types).toContain("customFront");
    expect(types).toContain("structureEntity");
    // Sorted by duration descending: member (1h) > customFront (30m) > structureEntity (15m)
    expect(result.subjectBreakdowns[0]?.subjectId).toBe("mem_alpha");
    expect(result.subjectBreakdowns[1]?.subjectId).toBe("cf_beta");
    expect(result.subjectBreakdowns[2]?.subjectId).toBe("ste_gamma");
  });

  it("applies no date clamping with all-time preset", async () => {
    const { db, chain } = mockDb();
    const dateRange = makeDateRange({
      preset: "all-time" as DateRangeFilter["preset"],
      start: 0 as DateRangeFilter["start"],
      end: NOW as DateRangeFilter["end"],
    });
    // Session far in the past — should be fully included without clamping
    const row = makeSessionRow({
      startTime: 1_000_000,
      endTime: 2_000_000,
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await computeFrontingBreakdown(db, SYSTEM_ID, AUTH, dateRange);

    expect(result.subjectBreakdowns).toHaveLength(1);
    expect(result.subjectBreakdowns[0]?.totalDuration).toBe(1_000_000);
    expect(result.dateRange.preset).toBe("all-time");
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

  it("returns truncated flag", async () => {
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
    expect(result.coFrontingPercentage).toBe(100);
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
    // Each pair has a percentageOfTotal field
    for (const pair of result.pairs) {
      expect(pair.percentageOfTotal).toBeGreaterThan(0);
      expect(pair.percentageOfTotal).toBeLessThanOrEqual(100);
    }
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
  });
});
