import { frontingSessions } from "@pluralscape/db/pg";
import { brandId, toDuration } from "@pluralscape/types";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ANALYTICS_SESSIONS } from "../../quota.constants.js";

import { toOneDecimalPercent } from "./internal.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  CoFrontingAnalytics,
  CoFrontingPair,
  DateRangeFilter,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface SessionRow {
  readonly id: string;
  readonly systemId: string;
  readonly memberId: string | null;
  readonly customFrontId: string | null;
  readonly structureEntityId: string | null;
  readonly startTime: number;
  readonly endTime: number | null;
}

function effectiveEndTime(row: SessionRow): number {
  return row.endTime ?? Date.now();
}

/** Clamp a session's start/end to the date range, returning both bounds. */
function getClampedBounds(
  row: SessionRow,
  dateRange: DateRangeFilter,
): { start: number; end: number } {
  const start =
    dateRange.preset === "all-time" ? row.startTime : Math.max(row.startTime, dateRange.start);
  const end =
    dateRange.preset === "all-time"
      ? effectiveEndTime(row)
      : Math.min(effectiveEndTime(row), dateRange.end);
  return { start, end };
}

async function fetchSessionsInRange(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<{ rows: readonly SessionRow[]; truncated: boolean }> {
  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [
      eq(frontingSessions.systemId, systemId),
      eq(frontingSessions.archived, false),
    ];

    // Only apply date range filters for non-all-time presets
    if (dateRange.preset !== "all-time") {
      // Sessions that overlap the range: startTime <= end AND (endTime > start OR endTime IS NULL)
      conditions.push(lte(frontingSessions.startTime, dateRange.end));
      const endTimeOverlap = or(
        isNull(frontingSessions.endTime),
        gt(frontingSessions.endTime, dateRange.start),
      );
      if (endTimeOverlap) conditions.push(endTimeOverlap);
    }

    const rows = await tx
      .select({
        id: frontingSessions.id,
        systemId: frontingSessions.systemId,
        memberId: frontingSessions.memberId,
        customFrontId: frontingSessions.customFrontId,
        structureEntityId: frontingSessions.structureEntityId,
        startTime: frontingSessions.startTime,
        endTime: frontingSessions.endTime,
      })
      .from(frontingSessions)
      .where(and(...conditions))
      .orderBy(desc(frontingSessions.startTime))
      .limit(MAX_ANALYTICS_SESSIONS);

    return { rows, truncated: rows.length >= MAX_ANALYTICS_SESSIONS };
  });
}

export async function computeCoFrontingBreakdown(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<CoFrontingAnalytics> {
  assertSystemOwnership(systemId, auth);

  const { rows, truncated } = await fetchSessionsInRange(db, systemId, auth, dateRange);

  // Only include sessions with a member subject for co-fronting analysis
  const memberSessions = rows.filter((r) => r.memberId !== null);

  // Pre-compute clamped bounds to avoid redundant recalculation in sort + loops
  const boundsMap = new Map<string, { start: number; end: number }>();
  for (const session of memberSessions) {
    boundsMap.set(session.id, getClampedBounds(session, dateRange));
  }

  // Calculate pair overlaps
  const pairMap = new Map<
    string,
    { memberA: string; memberB: string; totalDuration: number; sessionCount: number }
  >();

  // Sort by clamped start time ascending for early termination
  const sorted = [...memberSessions].sort((a, b) => {
    const boundsA = boundsMap.get(a.id);
    const boundsB = boundsMap.get(b.id);
    if (!boundsA || !boundsB) return 0;
    return boundsA.start - boundsB.start;
  });

  for (let i = 0; i < sorted.length; i++) {
    const sessionA = sorted[i];
    if (!sessionA) continue;

    const boundsA = boundsMap.get(sessionA.id);
    if (!boundsA || boundsA.end <= boundsA.start) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const sessionB = sorted[j];
      if (!sessionB) continue;

      const boundsB = boundsMap.get(sessionB.id);
      if (!boundsB) continue;

      // Since sorted by start, if B starts after A ends, no more overlaps for A
      if (boundsB.start >= boundsA.end) break;

      // Skip if same member
      if (sessionA.memberId === sessionB.memberId) continue;

      if (boundsB.end <= boundsB.start) continue;

      const overlapStart = Math.max(boundsA.start, boundsB.start);
      const overlapEnd = Math.min(boundsA.end, boundsB.end);
      const overlap = overlapEnd - overlapStart;

      if (overlap <= 0) continue;

      // Canonical ordering: lexicographic by member ID
      const [memberA, memberB] =
        (sessionA.memberId ?? "") < (sessionB.memberId ?? "")
          ? [sessionA.memberId ?? "", sessionB.memberId ?? ""]
          : [sessionB.memberId ?? "", sessionA.memberId ?? ""];

      // Canonical key for deduplication only — memberA/memberB read from value
      const pairKey = `${memberA}:${memberB}`;
      const existing = pairMap.get(pairKey);
      if (existing) {
        existing.totalDuration += overlap;
        existing.sessionCount += 1;
      } else {
        pairMap.set(pairKey, {
          memberA,
          memberB,
          totalDuration: overlap,
          sessionCount: 1,
        });
      }
    }
  }

  // Sweep-line algorithm for accurate co-fronting percentage (union-based)
  interface SweepEvent {
    time: number;
    delta: 1 | -1;
  }
  const events: SweepEvent[] = [];
  for (const session of memberSessions) {
    const bounds = boundsMap.get(session.id);
    if (!bounds || bounds.end <= bounds.start) continue;
    events.push({ time: bounds.start, delta: 1 }, { time: bounds.end, delta: -1 });
  }
  // Sort by time; at the same time, process starts before ends
  events.sort((a, b) => a.time - b.time || b.delta - a.delta);

  let activeSessions = 0;
  let prevTime = 0;
  let totalFrontingUnion = 0;
  let totalCoFronting = 0;

  for (const event of events) {
    if (activeSessions > 0) {
      const elapsed = event.time - prevTime;
      totalFrontingUnion += elapsed;
      if (activeSessions > 1) totalCoFronting += elapsed;
    }
    activeSessions += event.delta;
    prevTime = event.time;
  }

  const coFrontingPercentage = toOneDecimalPercent(totalCoFronting, totalFrontingUnion);

  // Build pairs
  const pairs: CoFrontingPair[] = [];
  for (const pair of pairMap.values()) {
    pairs.push({
      memberA: brandId<MemberId>(pair.memberA),
      memberB: brandId<MemberId>(pair.memberB),
      totalDuration: toDuration(pair.totalDuration),
      sessionCount: pair.sessionCount,
      percentageOfTotal: toOneDecimalPercent(pair.totalDuration, totalFrontingUnion),
    });
  }

  // Sort by total duration descending
  pairs.sort((a, b) => (b.totalDuration as number) - (a.totalDuration as number));

  return {
    systemId,
    dateRange,
    coFrontingPercentage,
    pairs,
    truncated,
  };
}
