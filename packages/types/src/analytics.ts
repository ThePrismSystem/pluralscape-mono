import type { Brand, FrontingReportId, MemberId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { DateRange } from "./utility.js";

/** A duration in milliseconds — branded for type safety. */
export type Duration = Brand<number, "Duration">;

/** Date range preset options for analytics queries. */
export type DateRangePreset =
  | "last-7-days"
  | "last-30-days"
  | "last-90-days"
  | "last-year"
  | "all-time"
  | "custom";

/** A date range filter for analytics queries. */
export interface DateRangeFilter extends DateRange {
  readonly preset: DateRangePreset | null;
}

/** Fronting analytics breakdown for a single member. */
export interface MemberFrontingBreakdown {
  readonly memberId: MemberId;
  readonly totalDuration: Duration;
  readonly sessionCount: number;
  readonly averageSessionLength: Duration;
  readonly percentageOfTotal: number;
}

/** Full fronting analytics for a system over a time range. */
export interface FrontingAnalytics {
  readonly systemId: SystemId;
  readonly dateRange: DateRange;
  readonly memberBreakdowns: readonly MemberFrontingBreakdown[];
}

/** A generated fronting report entity. */
export interface FrontingReport {
  readonly id: FrontingReportId;
  readonly systemId: SystemId;
  readonly dateRange: DateRange;
  readonly memberBreakdowns: readonly MemberFrontingBreakdown[];
  readonly chartData: readonly ChartData[];
  readonly format: "html" | "pdf";
  readonly generatedAt: UnixMillis;
}

/** A single data point in a chart dataset. */
export interface ChartDataset {
  readonly label: string;
  readonly data: readonly number[];
  readonly color: string;
}

/** Chart data suitable for rendering a fronting chart. */
export interface ChartData {
  readonly chartType: "pie" | "bar" | "timeline";
  readonly labels: readonly string[];
  readonly datasets: readonly ChartDataset[];
}
