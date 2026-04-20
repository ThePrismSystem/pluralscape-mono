import { frontingSessions } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, count, desc, eq, gt, isNull, isNotNull, lte, or, sql, sum } from "drizzle-orm";

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

/** Multiplier for one-decimal-place percentage rounding. */
const PERCENT_SCALE = 1000;
const PERCENT_DIVISOR = 10;

/** Round a ratio to one decimal place as a percentage (e.g. 0.333 → 33.3). */
function toOneDecimalPercent(numerator: number, denominator: number): number {
  return denominator > 0
    ? Math.round((numerator / denominator) * PERCENT_SCALE) / PERCENT_DIVISOR
    : 0;
}

/**
 * Per-subject aggregated row produced by a Postgres GROUP BY over
 * fronting_sessions. Mirrors the shape of SubjectFrontingBreakdown before
 * percentage math is applied in JS.
 */
interface SubjectAggregateRow {
  readonly subjectType: FrontingSubjectType;
  readonly subjectId: string;
  readonly totalDuration: number;
  readonly sessionCount: number;
}

/**
 * Aggregate sessions by subject in Postgres. Replaces the previous pattern
 * of fetching up to MAX_ANALYTICS_SESSIONS raw rows and summing in JS.
 *
 * The clamped-duration expression handles three cases atomically:
 *  - the session straddles both range bounds → use the whole range
 *  - the session ends with `NULL` (currently fronting) → use NOW() for end
 *  - the "all-time" preset → no clamping
 *
 * Rows with duration <= 0 are excluded by the HAVING clause so we don't
 * emit zero-duration subjects. Archived sessions are excluded.
 *
 * Returns one row per (subjectType, subjectId), plus a truncated flag that
 * becomes true if the DB clipped the GROUP BY at MAX_ANALYTICS_SESSIONS —
 * the cap is retained as a safety net against pathological systems.
 */
async function aggregateSubjectBreakdown(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<{ rows: readonly SubjectAggregateRow[]; truncated: boolean }> {
  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [
      eq(frontingSessions.systemId, systemId),
      eq(frontingSessions.archived, false),
      // At least one of the three subject columns must be non-null for the
      // row to have a meaningful subject breakdown.
      or(
        isNotNull(frontingSessions.memberId),
        isNotNull(frontingSessions.customFrontId),
        isNotNull(frontingSessions.structureEntityId),
      ) ?? sql`TRUE`,
    ];

    if (dateRange.preset !== "all-time") {
      conditions.push(lte(frontingSessions.startTime, dateRange.end));
      const endTimeOverlap = or(
        isNull(frontingSessions.endTime),
        gt(frontingSessions.endTime, dateRange.start),
      );
      if (endTimeOverlap) conditions.push(endTimeOverlap);
    }

    // Clamped duration in ms. Session timestamps are stored as timestamptz,
    // so we cast the request-provided Unix millis to timestamptz via
    // `to_timestamp(ms / 1000)` for the GREATEST/LEAST calls and then
    // extract the clamped interval back to millis via EPOCH * 1000.
    const rangeStartTs =
      dateRange.preset === "all-time"
        ? null
        : sql`to_timestamp(${dateRange.start}::double precision / 1000)`;
    const rangeEndTs =
      dateRange.preset === "all-time"
        ? null
        : sql`to_timestamp(${dateRange.end}::double precision / 1000)`;
    const startBoundSql =
      rangeStartTs === null
        ? sql`${frontingSessions.startTime}`
        : sql`GREATEST(${frontingSessions.startTime}, ${rangeStartTs})`;
    const endBoundSql =
      rangeEndTs === null
        ? sql`COALESCE(${frontingSessions.endTime}, NOW())`
        : sql`LEAST(COALESCE(${frontingSessions.endTime}, NOW()), ${rangeEndTs})`;
    // EXTRACT(EPOCH FROM (ts - ts)) returns the interval in seconds as a
    // double; multiply by 1000 and coerce to bigint for a stable integer
    // millisecond duration. GREATEST(0, ...) handles windows where a
    // session lies entirely outside the range.
    const clampedDurationSql = sql<number>`GREATEST(0, (EXTRACT(EPOCH FROM ((${endBoundSql}) - (${startBoundSql}))) * 1000)::bigint)`;

    // Build a single "subject" discriminator via CASE so one GROUP BY
    // covers all three subject kinds rather than three separate queries.
    const subjectTypeSql = sql<FrontingSubjectType>`CASE
      WHEN ${frontingSessions.memberId} IS NOT NULL THEN 'member'
      WHEN ${frontingSessions.customFrontId} IS NOT NULL THEN 'customFront'
      WHEN ${frontingSessions.structureEntityId} IS NOT NULL THEN 'structureEntity'
    END`;
    const subjectIdSql = sql<string>`COALESCE(${frontingSessions.memberId}, ${frontingSessions.customFrontId}, ${frontingSessions.structureEntityId})`;

    const rows = await tx
      .select({
        subjectType: subjectTypeSql.as("subject_type"),
        subjectId: subjectIdSql.as("subject_id"),
        totalDuration: sum(clampedDurationSql).mapWith(Number).as("total_duration"),
        sessionCount: count().as("session_count"),
      })
      .from(frontingSessions)
      .where(and(...conditions))
      .groupBy(subjectTypeSql, subjectIdSql)
      .having(sql`SUM(${clampedDurationSql}) > 0`)
      .orderBy(desc(sum(clampedDurationSql)))
      .limit(MAX_ANALYTICS_SESSIONS);

    // `truncated` is conservative: only reports true when the DB hit the
    // safety LIMIT, matching the contract of the legacy implementation.
    return {
      rows: rows.map((r) => ({
        subjectType: r.subjectType,
        subjectId: r.subjectId,
        totalDuration: r.totalDuration,
        sessionCount: r.sessionCount,
      })),
      truncated: rows.length >= MAX_ANALYTICS_SESSIONS,
    };
  });
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

/** Brand a raw subject id string to the correct ID type for its subject class. */
function brandSubjectId(type: FrontingSubjectType, id: string): SubjectId {
  switch (type) {
    case "member":
      return brandId<MemberId>(id);
    case "customFront":
      return brandId<CustomFrontId>(id);
    case "structureEntity":
      return brandId<SystemStructureEntityId>(id);
    default:
      return type satisfies never;
  }
}

export async function computeFrontingBreakdown(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  dateRange: DateRangeFilter,
): Promise<FrontingAnalytics> {
  assertSystemOwnership(systemId, auth);

  // Aggregation now runs inside Postgres via GROUP BY on a clamped-duration
  // expression (see aggregateSubjectBreakdown). The previous implementation
  // streamed up to MAX_ANALYTICS_SESSIONS raw rows into the node process and
  // summed them in JS, which wasted bandwidth and CPU on common systems.
  const { rows, truncated } = await aggregateSubjectBreakdown(db, systemId, auth, dateRange);

  const totalDuration = rows.reduce((acc, r) => acc + r.totalDuration, 0);

  const subjectBreakdowns: SubjectFrontingBreakdown[] = rows.map((r) => ({
    subjectType: r.subjectType,
    subjectId: brandSubjectId(r.subjectType, r.subjectId),
    totalDuration: r.totalDuration as Duration,
    sessionCount: r.sessionCount,
    averageSessionLength: (r.sessionCount > 0
      ? Math.round(r.totalDuration / r.sessionCount)
      : 0) as Duration,
    percentageOfTotal: toOneDecimalPercent(r.totalDuration, totalDuration),
  }));

  // Rows already come back sorted by total duration desc, but we still
  // resort defensively after branding to honour the public contract.
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
