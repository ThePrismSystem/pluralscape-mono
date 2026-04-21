import { frontingSessions } from "@pluralscape/db/pg";
import { brandId, toDuration } from "@pluralscape/types";
import { and, count, desc, eq, gt, isNull, isNotNull, lte, or, sql, sum } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ANALYTICS_SESSIONS } from "../../quota.constants.js";

import { toOneDecimalPercent } from "./internal.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  CustomFrontId,
  DateRangeFilter,
  FrontingAnalytics,
  FrontingSubjectType,
  MemberId,
  SubjectFrontingBreakdown,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type SubjectId = MemberId | CustomFrontId | SystemStructureEntityId;

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
    // At least one of the three subject columns must be non-null for the row
    // to have a meaningful subject breakdown. Drizzle's `or()` returns
    // `undefined` only for an empty arg list; three non-null predicates always
    // yield a defined expression, so the previous `?? sql\`TRUE\`` fallback
    // was unreachable. `and(...)` accepts undefined entries and skips them, so
    // the spread is safe if Drizzle's typing ever widens.
    const subjectPresent = or(
      isNotNull(frontingSessions.memberId),
      isNotNull(frontingSessions.customFrontId),
      isNotNull(frontingSessions.structureEntityId),
    );
    const conditions = [
      eq(frontingSessions.systemId, systemId),
      eq(frontingSessions.archived, false),
      subjectPresent,
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

    // Pre-aggregate COUNT to preserve the original `truncated` contract:
    // aggregation switched from "raw rows" to "one row per subject", so the
    // post-aggregate row count ≥ cap would silently report `truncated:
    // false` for systems with >cap raw sessions across few subjects. Run
    // the same WHERE against frontingSessions to count raw-session volume
    // explicitly; aggregate LIMIT remains a pathology safety valve.
    const [rawCountRow] = await tx
      .select({ n: count().as("n") })
      .from(frontingSessions)
      .where(and(...conditions));
    const rawSessionCount = rawCountRow?.n ?? 0;

    // Clamp SUM(bigint) to JS safe-int so the mapWith(Number) cast never
    // silently loses precision for long all-time windows where per-session
    // clamped durations can aggregate past 2^53 ms.
    const clampedSumSql = sql<number>`LEAST(SUM(${clampedDurationSql}), ${Number.MAX_SAFE_INTEGER}::bigint)`;

    const rows = await tx
      .select({
        subjectType: subjectTypeSql.as("subject_type"),
        subjectId: subjectIdSql.as("subject_id"),
        totalDuration: clampedSumSql.mapWith(Number).as("total_duration"),
        sessionCount: count().as("session_count"),
      })
      .from(frontingSessions)
      .where(and(...conditions))
      .groupBy(subjectTypeSql, subjectIdSql)
      .having(sql`SUM(${clampedDurationSql}) > 0`)
      .orderBy(desc(sum(clampedDurationSql)))
      .limit(MAX_ANALYTICS_SESSIONS);

    // `truncated` reflects the raw-session count vs. the cap, matching the
    // legacy "did we see more rows than we could hold" contract. The
    // aggregate LIMIT stays as a pathology safety net but doesn't feed
    // the flag directly.
    return {
      rows: rows.map((r) => ({
        subjectType: r.subjectType,
        subjectId: r.subjectId,
        totalDuration: r.totalDuration,
        sessionCount: r.sessionCount,
      })),
      truncated: rawSessionCount >= MAX_ANALYTICS_SESSIONS,
    };
  });
}

/** Brand a raw subject id string to the correct ID type for its subject class. */
function brandSubjectId(type: FrontingSubjectType, id: string): SubjectId {
  switch (type) {
    case "member":
      return brandId<MemberId>(id);
    case "customFront":
      return brandId<CustomFrontId>(id);
    case "structureEntity":
      return brandId<SystemStructureEntityId>(id);
    default: {
      // Compile-time exhaustiveness plus a runtime guard: `return type
      // satisfies never` silently returned an unbranded string if a new
      // discriminator was ever added. Throwing keeps the invariant loud.
      const _exhaustive: never = type;
      throw new Error(`unhandled fronting subject type: ${_exhaustive as string}`);
    }
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
    totalDuration: toDuration(r.totalDuration),
    sessionCount: r.sessionCount,
    averageSessionLength: toDuration(
      r.sessionCount > 0 ? Math.round(r.totalDuration / r.sessionCount) : 0,
    ),
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
