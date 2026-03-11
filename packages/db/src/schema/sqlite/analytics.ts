import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

/** Unbranded DB-layer equivalent of DateRange (avoids branded UnixMillis in Drizzle types). */
interface DbDateRange {
  readonly start: number;
  readonly end: number;
}

/** Unbranded DB-layer equivalent of MemberFrontingBreakdown. */
interface DbMemberFrontingBreakdown {
  readonly memberId: string;
  readonly totalDuration: number;
  readonly sessionCount: number;
  readonly averageSessionLength: number;
  readonly percentageOfTotal: number;
}

/** Unbranded DB-layer equivalent of ChartDataset. */
interface DbChartDataset {
  readonly label: string;
  readonly data: readonly number[];
  readonly color: string;
}

/** Unbranded DB-layer equivalent of ChartData. */
interface DbChartData {
  readonly chartType: "pie" | "bar" | "timeline";
  readonly labels: readonly string[];
  readonly datasets: readonly DbChartDataset[];
}

export const frontingReports = sqliteTable(
  "fronting_reports",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    dateRange: sqliteJson("date_range").notNull().$type<DbDateRange>(),
    memberBreakdowns: sqliteJson("member_breakdowns")
      .notNull()
      .$type<readonly DbMemberFrontingBreakdown[]>(),
    chartData: sqliteJson("chart_data").notNull().$type<readonly DbChartData[]>(),
    format: text("format").notNull().$type<"html" | "pdf">(),
    generatedAt: sqliteTimestamp("generated_at").notNull(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
  ],
);
