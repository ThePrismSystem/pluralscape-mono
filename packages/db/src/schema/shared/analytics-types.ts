/**
 * DB-layer analytics types — unbranded equivalents of the domain types in @pluralscape/types.
 *
 * Fronting reports are generated client-side. Member names appearing in chart labels
 * are T1 encrypted before storage. Member IDs are non-identifying opaque tokens (T3).
 */

/** Unbranded DB-layer equivalent of DateRange (avoids branded UnixMillis in Drizzle types). */
export interface DbDateRange {
  readonly start: number;
  readonly end: number;
}

/** Unbranded DB-layer equivalent of MemberFrontingBreakdown. */
export interface DbMemberFrontingBreakdown {
  readonly memberId: string;
  readonly totalDuration: number;
  readonly sessionCount: number;
  readonly averageSessionLength: number;
  readonly percentageOfTotal: number;
}

/** Unbranded DB-layer equivalent of ChartDataset. */
export interface DbChartDataset {
  readonly label: string;
  readonly data: readonly number[];
  readonly color: string;
}

/** Unbranded DB-layer equivalent of ChartData. */
export interface DbChartData {
  readonly chartType: "pie" | "bar" | "timeline";
  readonly labels: readonly string[];
  readonly datasets: readonly DbChartDataset[];
}
