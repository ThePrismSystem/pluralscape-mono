import type { Brand, MemberId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** A duration in milliseconds — branded for type safety. */
export type Duration = Brand<number, "Duration">;

/** Date range preset options for analytics queries. */
export type DateRangePreset = "today" | "week" | "month" | "quarter" | "year" | "all-time";

/** A date range filter for analytics queries. */
export interface DateRangeFilter {
  readonly start: UnixMillis;
  readonly end: UnixMillis;
  readonly preset: DateRangePreset | null;
}

/** Fronting analytics breakdown for a single member. */
export interface MemberFrontingBreakdown {
  readonly memberId: MemberId;
  readonly totalDuration: Duration;
  readonly sessionCount: number;
  readonly averageDuration: Duration;
  readonly percentage: number;
}

/** Full fronting analytics for a system over a time range. */
export interface FrontingAnalytics {
  readonly systemId: SystemId;
  readonly filter: DateRangeFilter;
  readonly totalDuration: Duration;
  readonly totalSessions: number;
  readonly memberBreakdowns: readonly MemberFrontingBreakdown[];
}

/** A single report combining analytics with metadata. */
export interface FrontingReport {
  readonly analytics: FrontingAnalytics;
  readonly generatedAt: UnixMillis;
}

/** A single data point in a chart dataset. */
export interface ChartDataset {
  readonly label: string;
  readonly data: readonly number[];
}

/** Chart data suitable for rendering a fronting chart. */
export interface ChartData {
  readonly labels: readonly string[];
  readonly datasets: readonly ChartDataset[];
}
