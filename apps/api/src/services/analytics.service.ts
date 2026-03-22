import { frontingSessions } from "@pluralscape/db/pg";
import { and, eq, gte, lte } from "drizzle-orm";

import { assertSystemOwnership } from "../lib/system-ownership.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  CoFrontingAnalytics,
  CoFrontingPair,
  DateRangeFilter,
  Duration,
  FrontingSubjectType,
  MemberId,
  SubjectFrontingBreakdown,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/**
 * Maximum number of sessions to fetch for analytics computation.
 * Analytics queries operate over a time range; this cap prevents
 * runaway reads on extremely active systems.
 */
const MAX_ANALYTICS_SESSIONS = 10_000;

/** Percentage multiplier. */
const PERCENTAGE_FACTOR = 100;

// ── Types ────────────────────────────────────────────────────────────

interface FrontingBreakdownResult {
  readonly systemId: SystemId;
  readonly dateRange: DateRangeFilter;
  readonly subjectBreakdowns: readonly SubjectFrontingBreakdown[];
}

interface SessionRow {
  readonly id: string;
  readonly systemId: string;
  readonly memberId: string | null;
  readonly customFrontId: string | null;
  readonly structureEntityId: string | null;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly archived: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function resolveSubject(
  row: SessionRow,
): { subjectType: FrontingSubjectType; subjectId: string } | null {
  if (row.memberId) return { subjectType: "member", subjectId: row.memberId };
  if (row.customFrontId) return { subjectType: "customFront", subjectId: row.customFrontId };
  if (row.structureEntityId)
    return { subjectType: "structureEntity", subjectId: row.structureEntityId };
  return null;
}

function effectiveEndTime(row: SessionRow): number {
  return row.endTime ?? Date.now();
}

async function fetchSessionsInRange(
  db: PostgresJsDatabase,
  systemId: SystemId,
  dateRange: DateRangeFilter,
): Promise<readonly SessionRow[]> {
  const conditions = [
    eq(frontingSessions.systemId, systemId),
    eq(frontingSessions.archived, false),
  ];

  // Only apply date range filters for non-all-time presets
  if (dateRange.preset !== "all-time") {
    // Sessions that overlap the range: startTime < end AND (endTime > start OR endTime IS NULL)
    conditions.push(lte(frontingSessions.startTime, dateRange.end));
    conditions.push(
      // A session overlaps if it hasn't ended or its endTime is after range start
      gte(frontingSessions.startTime, dateRange.start),
    );
  }

  const rows = await db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      memberId: frontingSessions.memberId,
      customFrontId: frontingSessions.customFrontId,
      structureEntityId: frontingSessions.structureEntityId,
      startTime: frontingSessions.startTime,
      endTime: frontingSessions.endTime,
      archived: frontingSessions.archived,
    })
    .from(frontingSessions)
    .where(and(...conditions))
    .limit(MAX_ANALYTICS_SESSIONS);

  return rows;
}

// ── computeFrontingBreakdown ─────────────────────────────────────────

export async function computeFrontingBreakdown(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<FrontingBreakdownResult> {
  assertSystemOwnership(systemId, auth);

  const rows = await fetchSessionsInRange(db, systemId, dateRange);

  // Group by subject
  const subjectMap = new Map<string, { type: FrontingSubjectType; durations: number[] }>();

  for (const row of rows) {
    const subject = resolveSubject(row);
    if (!subject) continue;

    const key = `${subject.subjectType}:${subject.subjectId}`;
    const duration = effectiveEndTime(row) - row.startTime;

    const existing = subjectMap.get(key);
    if (existing) {
      existing.durations.push(duration);
    } else {
      subjectMap.set(key, { type: subject.subjectType, durations: [duration] });
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

  for (const [key, { type, durations }] of subjectMap.entries()) {
    const subjectId = key.slice(key.indexOf(":") + 1);
    const subjectTotal = durations.reduce((acc, d) => acc + d, 0);
    const sessionCount = durations.length;

    subjectBreakdowns.push({
      subjectType: type,
      subjectId: subjectId as SubjectFrontingBreakdown["subjectId"],
      totalDuration: subjectTotal as Duration,
      sessionCount,
      averageSessionLength: (sessionCount > 0
        ? Math.round(subjectTotal / sessionCount)
        : 0) as Duration,
      percentageOfTotal:
        totalDuration > 0 ? Math.round((subjectTotal / totalDuration) * PERCENTAGE_FACTOR) : 0,
    });
  }

  // Sort by total duration descending
  subjectBreakdowns.sort((a, b) => (b.totalDuration as number) - (a.totalDuration as number));

  return {
    systemId,
    dateRange,
    subjectBreakdowns,
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

  const rows = await fetchSessionsInRange(db, systemId, dateRange);

  // Only include sessions with a member subject for co-fronting analysis
  const memberSessions = rows.filter((r) => r.memberId !== null);

  // Calculate pair overlaps
  const pairMap = new Map<
    string,
    { memberA: string; memberB: string; totalDuration: number; sessionCount: number }
  >();

  for (let i = 0; i < memberSessions.length; i++) {
    const sessionA = memberSessions[i];
    if (!sessionA) continue;

    for (let j = i + 1; j < memberSessions.length; j++) {
      const sessionB = memberSessions[j];
      if (!sessionB) continue;

      // Skip if same member
      if (sessionA.memberId === sessionB.memberId) continue;

      // Calculate overlap
      const startA = sessionA.startTime;
      const endA = effectiveEndTime(sessionA);
      const startB = sessionB.startTime;
      const endB = effectiveEndTime(sessionB);

      const overlapStart = Math.max(startA, startB);
      const overlapEnd = Math.min(endA, endB);
      const overlap = overlapEnd - overlapStart;

      if (overlap <= 0) continue;

      // Canonical ordering: lexicographic by member ID
      const [memberA, memberB] =
        (sessionA.memberId ?? "") < (sessionB.memberId ?? "")
          ? [sessionA.memberId ?? "", sessionB.memberId ?? ""]
          : [sessionB.memberId ?? "", sessionA.memberId ?? ""];

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

  // Calculate total fronting time (union of all member sessions for coFrontingPercentage)
  let totalCoFrontDuration = 0;
  for (const pair of pairMap.values()) {
    totalCoFrontDuration += pair.totalDuration;
  }

  // Total fronting time = sum of all individual session durations
  let totalFrontingTime = 0;
  for (const session of memberSessions) {
    totalFrontingTime += effectiveEndTime(session) - session.startTime;
  }

  const coFrontingPercentage =
    totalFrontingTime > 0
      ? Math.round(
          (totalCoFrontDuration / totalFrontingTime) * PERCENTAGE_FACTOR * PERCENTAGE_FACTOR,
        ) / PERCENTAGE_FACTOR
      : 0;

  // Build pairs
  const pairs: CoFrontingPair[] = [];
  for (const pair of pairMap.values()) {
    pairs.push({
      memberA: pair.memberA as MemberId,
      memberB: pair.memberB as MemberId,
      totalDuration: pair.totalDuration as Duration,
      sessionCount: pair.sessionCount,
      percentageOfTotal:
        totalFrontingTime > 0
          ? Math.round(
              (pair.totalDuration / totalFrontingTime) * PERCENTAGE_FACTOR * PERCENTAGE_FACTOR,
            ) / PERCENTAGE_FACTOR
          : 0,
    });
  }

  // Sort by total duration descending
  pairs.sort((a, b) => (b.totalDuration as number) - (a.totalDuration as number));

  return {
    systemId,
    dateRange,
    coFrontingPercentage,
    pairs,
  };
}
