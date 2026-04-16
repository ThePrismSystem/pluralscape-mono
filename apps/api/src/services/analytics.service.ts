import { frontingSessions } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import { withTenantRead } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_ANALYTICS_SESSIONS } from "../quota.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  CoFrontingAnalytics,
  CoFrontingPair,
  CustomFrontId,
  DateRangeFilter,
  Duration,
  FrontingAnalytics,
  FrontingSubjectType,
  MemberId,
  SubjectFrontingBreakdown,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ────────────────────────────────────────────────────────────

type SubjectId = MemberId | CustomFrontId | SystemStructureEntityId;

interface SessionRow {
  readonly id: string;
  readonly systemId: string;
  readonly memberId: string | null;
  readonly customFrontId: string | null;
  readonly structureEntityId: string | null;
  readonly startTime: number;
  readonly endTime: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function resolveSubject(
  row: SessionRow,
): { subjectType: FrontingSubjectType; subjectId: SubjectId } | null {
  if (row.memberId) return { subjectType: "member", subjectId: brandId<MemberId>(row.memberId) };
  if (row.customFrontId)
    return { subjectType: "customFront", subjectId: brandId<CustomFrontId>(row.customFrontId) };
  if (row.structureEntityId)
    return {
      subjectType: "structureEntity",
      subjectId: brandId<SystemStructureEntityId>(row.structureEntityId),
    };
  return null;
}

function effectiveEndTime(row: SessionRow): number {
  return row.endTime ?? Date.now();
}

/** Clamp a session's duration to the requested date range. */
function getClampedInterval(row: SessionRow, dateRange: DateRangeFilter): number {
  const start =
    dateRange.preset === "all-time" ? row.startTime : Math.max(row.startTime, dateRange.start);
  const end =
    dateRange.preset === "all-time"
      ? effectiveEndTime(row)
      : Math.min(effectiveEndTime(row), dateRange.end);
  return Math.max(0, end - start);
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

/** Multiplier for one-decimal-place percentage rounding. */
const PERCENT_SCALE = 1000;
const PERCENT_DIVISOR = 10;

/** Round a ratio to one decimal place as a percentage (e.g. 0.333 → 33.3). */
function toOneDecimalPercent(numerator: number, denominator: number): number {
  return denominator > 0
    ? Math.round((numerator / denominator) * PERCENT_SCALE) / PERCENT_DIVISOR
    : 0;
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

// ── computeFrontingBreakdown ─────────────────────────────────────────

export async function computeFrontingBreakdown(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<FrontingAnalytics> {
  assertSystemOwnership(systemId, auth);

  const { rows, truncated } = await fetchSessionsInRange(db, systemId, auth, dateRange);

  // Group by subject
  const subjectMap = new Map<
    string,
    { type: FrontingSubjectType; subjectId: SubjectId; durations: number[] }
  >();

  for (const row of rows) {
    const subject = resolveSubject(row);
    if (!subject) continue;

    const key = `${subject.subjectType}:${subject.subjectId}`;
    const duration = getClampedInterval(row, dateRange);
    if (duration <= 0) continue;

    const existing = subjectMap.get(key);
    if (existing) {
      existing.durations.push(duration);
    } else {
      subjectMap.set(key, {
        type: subject.subjectType,
        subjectId: subject.subjectId,
        durations: [duration],
      });
    }
  }

  // Calculate totals
  let totalDuration = 0;
  for (const { durations } of subjectMap.values()) {
    for (const d of durations) {
      totalDuration += d;
    }
  }

  // Build breakdowns
  const subjectBreakdowns: SubjectFrontingBreakdown[] = [];

  for (const [, { type, subjectId, durations }] of subjectMap.entries()) {
    const subjectTotal = durations.reduce((acc, d) => acc + d, 0);
    const sessionCount = durations.length;

    subjectBreakdowns.push({
      subjectType: type,
      subjectId,
      totalDuration: subjectTotal as Duration,
      sessionCount,
      averageSessionLength: (sessionCount > 0
        ? Math.round(subjectTotal / sessionCount)
        : 0) as Duration,
      percentageOfTotal: toOneDecimalPercent(subjectTotal, totalDuration),
    });
  }

  // Sort by total duration descending
  subjectBreakdowns.sort((a, b) => (b.totalDuration as number) - (a.totalDuration as number));

  return {
    systemId,
    dateRange,
    subjectBreakdowns,
    truncated,
  };
}

// ── computeCoFrontingBreakdown ───────────────────────────────────────

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
      totalDuration: pair.totalDuration as Duration,
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
