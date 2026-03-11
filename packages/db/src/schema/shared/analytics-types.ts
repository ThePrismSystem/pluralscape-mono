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
