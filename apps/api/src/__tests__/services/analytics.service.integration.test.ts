import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  computeCoFrontingBreakdown,
  computeFrontingBreakdown,
} from "../../services/analytics.service.js";
import { asDb, genFrontingSessionId, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, DateRangeFilter, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { members, customFronts, frontingSessions } = schema;

/** Milliseconds in one hour. */
const MS_PER_HOUR = 3_600_000;

/** Fixed base timestamp for deterministic test data. */
const baseTime = Date.now();

describe("analytics.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingSessions);
    await db.delete(customFronts);
    await db.delete(members);
  });

  /**
   * Insert a fronting session directly into the database.
   * Accepts partial overrides on top of sensible defaults.
   */
  async function insertSession(overrides: Record<string, unknown> = {}): Promise<void> {
    const defaults = {
      id: genFrontingSessionId(),
      systemId,
      startTime: baseTime - MS_PER_HOUR,
      endTime: baseTime,
      memberId: null,
      customFrontId: null,
      structureEntityId: null,
      encryptedData: testBlob(),
      createdAt: baseTime,
      updatedAt: baseTime,
      version: 1,
      archived: false,
      archivedAt: null,
    };
    await db.insert(frontingSessions).values({ ...defaults, ...overrides } as never);
  }

  /** Build a custom DateRangeFilter for the given start/end timestamps. */
  function customRange(start: number, end: number): DateRangeFilter {
    return { preset: "custom" as const, start, end } as DateRangeFilter;
  }

  // ── computeFrontingBreakdown ────────────────────────────────────────

  describe("computeFrontingBreakdown", () => {
    it("returns empty breakdowns when no sessions exist", async () => {
      const dateRange = customRange(baseTime - 24 * MS_PER_HOUR, baseTime);

      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it("computes breakdown for a single member session fully within range", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 3 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(1);
      const breakdown = result.subjectBreakdowns[0];
      expect(breakdown?.subjectType).toBe("member");
      expect(breakdown?.subjectId).toBe(memberId);
      expect(breakdown?.totalDuration).toBe(MS_PER_HOUR);
      expect(breakdown?.sessionCount).toBe(1);
      expect(breakdown?.percentageOfTotal).toBe(100);
    });

    it("clamps session starting before date range", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        startTime: baseTime - 5 * MS_PER_HOUR,
        endTime: baseTime - 2 * MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 3 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(1);
      expect(result.subjectBreakdowns[0]?.totalDuration).toBe(MS_PER_HOUR);
    });

    it("clamps session ending after date range", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime - 2 * MS_PER_HOUR);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(1);
      expect(result.subjectBreakdowns[0]?.totalDuration).toBe(2 * MS_PER_HOUR);
    });

    it("excludes sessions entirely outside date range", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        startTime: baseTime - 10 * MS_PER_HOUR,
        endTime: baseTime - 8 * MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 3 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toEqual([]);
    });

    it("handles multiple subjects with correct percentages", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Member A: 3-hour session
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      // Member B: 1-hour session
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 5 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(2);

      const breakdownA = result.subjectBreakdowns.find((b) => b.subjectId === memberA);
      const breakdownB = result.subjectBreakdowns.find((b) => b.subjectId === memberB);
      expect(breakdownA?.percentageOfTotal).toBe(75);
      expect(breakdownB?.percentageOfTotal).toBe(25);
    });

    it("excludes archived sessions", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        archived: true,
        archivedAt: baseTime,
      });

      const dateRange = customRange(baseTime - 3 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toEqual([]);
    });

    it("sorts breakdowns by total duration descending", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Member A: 1-hour session
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      // Member B: 2-hour session
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(2);
      expect(result.subjectBreakdowns[0]?.subjectId).toBe(memberB);
      expect(result.subjectBreakdowns[1]?.subjectId).toBe(memberA);
    });
  });

  // ── computeCoFrontingBreakdown ──────────────────────────────────────

  describe("computeCoFrontingBreakdown", () => {
    it("returns empty pairs when no sessions exist", async () => {
      const dateRange = customRange(baseTime - 24 * MS_PER_HOUR, baseTime);

      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toEqual([]);
      expect(result.coFrontingPercentage).toBe(0);
    });

    it("detects overlapping member sessions", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Member A: -3h to -1h
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      // Member B: -2h to now (overlap: -2h to -1h = 1 hour)
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.totalDuration).toBe(MS_PER_HOUR);
    });

    it("returns empty pairs when sessions do not overlap", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Member A: -4h to -3h
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - 3 * MS_PER_HOUR,
      });

      // Member B: -2h to -1h (no overlap)
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 5 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toEqual([]);
    });

    it("excludes customFront sessions from co-fronting", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;

      // Insert a custom front row (FK requirement)
      const cfId = `cf_${crypto.randomUUID()}`;
      await db.insert(customFronts).values({
        id: cfId,
        systemId,
        encryptedData: testBlob(),
        createdAt: baseTime,
        updatedAt: baseTime,
        version: 1,
        archived: false,
        archivedAt: null,
      } as never);

      // Member session: -3h to -1h
      await insertSession({
        memberId,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      // Custom front session overlapping: -2h to now
      await insertSession({
        customFrontId: cfId,
        memberId: null,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toEqual([]);
    });

    it("detects multiple overlapping pairs", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;
      const memberC = (await pgInsertMember(db, systemId)) as MemberId;

      // All three overlap across -3h to now
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime,
      });
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime,
      });
      await insertSession({
        memberId: memberC,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      // A-B, A-C, B-C
      expect(result.pairs).toHaveLength(3);
    });

    it("uses canonical ordering with smaller ID first in pair", async () => {
      // Insert members with known IDs to control lexicographic order
      const laterId = `mem_z${crypto.randomUUID()}` as MemberId;
      const earlierId = `mem_a${crypto.randomUUID()}` as MemberId;

      await pgInsertMember(db, systemId, laterId);
      await pgInsertMember(db, systemId, earlierId);

      // Both overlap: -3h to -1h
      await insertSession({
        memberId: laterId,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });
      await insertSession({
        memberId: earlierId,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.memberA).toBe(earlierId);
      expect(result.pairs[0]?.memberB).toBe(laterId);
    });

    it("skips co-fronting pair when sessions only touch at boundary (overlap === 0)", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Session A ends exactly when session B starts — no actual overlap
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - 2 * MS_PER_HOUR,
      });
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const dateRange = customRange(baseTime - 5 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.pairs).toEqual([]);
    });

    it("skips sessions that collapse to zero-length bounds after date-range clamping", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // Session A spans the whole range — valid
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      // Session B is entirely outside the range end (its clamped end === clamped start === range.end)
      // The range end is baseTime - 2h; session B starts at baseTime - 1h — it gets excluded by
      // the DB query, but we verify the result contains no pairs from a zero-length B.
      // To cover boundsA.end <= boundsA.start: insert a session that lies exactly at the boundary
      // of the range so its start is clamped to equal its end.
      await insertSession({
        memberId: memberB,
        // startTime == range.end, so after clamping: start = range.end, end = range.end → zero length
        startTime: baseTime - MS_PER_HOUR,
        endTime: baseTime,
      });

      // Range ends at baseTime - 1h; session B starts exactly at range end — zero-length after clamp
      const dateRange = customRange(baseTime - 4 * MS_PER_HOUR, baseTime - MS_PER_HOUR);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      // Session B is clamped to zero length; only A has valid bounds — no pairs possible
      expect(result.pairs).toEqual([]);
    });

    it("accumulates overlapping pair duration across multiple co-front intervals", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      // First overlap: -4h to -3h (1 hour)
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - 3 * MS_PER_HOUR,
      });
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 4 * MS_PER_HOUR,
        endTime: baseTime - 3 * MS_PER_HOUR,
      });

      // Second overlap: -2h to -1h (1 hour)
      await insertSession({
        memberId: memberA,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });

      const dateRange = customRange(baseTime - 5 * MS_PER_HOUR, baseTime);
      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      // One pair with accumulated 2 hours and 2 session count
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.totalDuration).toBe(2 * MS_PER_HOUR);
      expect(result.pairs[0]?.sessionCount).toBe(2);
    });
  });

  // ── all-time preset ─────────────────────────────────────────────────

  describe("all-time preset", () => {
    it("computeFrontingBreakdown returns all sessions regardless of time", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      await insertSession({
        memberId,
        startTime: baseTime - 100 * MS_PER_HOUR,
        endTime: baseTime - 99 * MS_PER_HOUR,
      });

      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, {
        preset: "all-time",
      } as DateRangeFilter);

      expect(result.subjectBreakdowns).toHaveLength(1);
      expect(result.subjectBreakdowns[0]?.subjectId).toBe(memberId);
      expect(result.subjectBreakdowns[0]?.totalDuration).toBe(MS_PER_HOUR);
    });

    it("computeFrontingBreakdown handles open-ended session with all-time preset", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      const sessionStart = Date.now() - MS_PER_HOUR;

      // No endTime — session is still ongoing
      await insertSession({
        memberId,
        startTime: sessionStart,
        endTime: null,
      });

      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, {
        preset: "all-time",
      } as DateRangeFilter);

      expect(result.subjectBreakdowns).toHaveLength(1);
      // Duration should be approximately 1 hour (open-ended, uses Date.now())
      const duration = result.subjectBreakdowns[0]?.totalDuration ?? 0;
      expect(duration).toBeGreaterThan(0);
    });

    it("computeCoFrontingBreakdown uses all-time preset and detects overlap", async () => {
      const memberA = (await pgInsertMember(db, systemId)) as MemberId;
      const memberB = (await pgInsertMember(db, systemId)) as MemberId;

      await insertSession({
        memberId: memberA,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime - MS_PER_HOUR,
      });
      await insertSession({
        memberId: memberB,
        startTime: baseTime - 2 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const result = await computeCoFrontingBreakdown(asDb(db), systemId, auth, {
        preset: "all-time",
      } as DateRangeFilter);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.totalDuration).toBe(MS_PER_HOUR);
    });
  });

  // ── computeFrontingBreakdown edge cases ─────────────────────────────

  describe("computeFrontingBreakdown edge cases", () => {
    it("excludes sessions clamped to zero duration from breakdown", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;

      // Session starts exactly at range end — clamped duration will be 0
      await insertSession({
        memberId,
        startTime: baseTime,
        endTime: baseTime + MS_PER_HOUR,
      });

      // Range ends at baseTime; session starts at baseTime — zero clamped duration
      const dateRange = customRange(baseTime - 2 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toEqual([]);
    });

    it("handles open-ended session in custom range", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      const sessionStart = Date.now() - MS_PER_HOUR;

      // No endTime — still ongoing; within the range
      await insertSession({
        memberId,
        startTime: sessionStart,
        endTime: null,
      });

      const rangeStart = sessionStart - MS_PER_HOUR;
      const rangeEnd = Date.now() + MS_PER_HOUR;
      const dateRange = customRange(rangeStart, rangeEnd);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(1);
      expect(result.subjectBreakdowns[0]?.totalDuration).toBeGreaterThan(0);
    });

    it("computes correct averageSessionLength with multiple sessions", async () => {
      const memberId = (await pgInsertMember(db, systemId)) as MemberId;

      // Two sessions: 1 hour and 3 hours → average 2 hours
      await insertSession({
        memberId,
        startTime: baseTime - 5 * MS_PER_HOUR,
        endTime: baseTime - 4 * MS_PER_HOUR,
      });
      await insertSession({
        memberId,
        startTime: baseTime - 3 * MS_PER_HOUR,
        endTime: baseTime,
      });

      const dateRange = customRange(baseTime - 6 * MS_PER_HOUR, baseTime);
      const result = await computeFrontingBreakdown(asDb(db), systemId, auth, dateRange);

      expect(result.subjectBreakdowns).toHaveLength(1);
      expect(result.subjectBreakdowns[0]?.averageSessionLength).toBe(2 * MS_PER_HOUR);
      expect(result.subjectBreakdowns[0]?.sessionCount).toBe(2);
    });
  });
});
