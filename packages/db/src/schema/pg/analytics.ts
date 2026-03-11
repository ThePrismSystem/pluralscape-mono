import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
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

export const frontingReports = pgTable(
  "fronting_reports",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    dateRange: jsonb("date_range").notNull().$type<DbDateRange>(),
    memberBreakdowns: jsonb("member_breakdowns")
      .notNull()
      .$type<readonly DbMemberFrontingBreakdown[]>(),
    chartData: jsonb("chart_data").notNull().$type<readonly DbChartData[]>(),
    format: varchar("format", { length: 255 }).notNull().$type<"html" | "pdf">(),
    generatedAt: pgTimestamp("generated_at").notNull(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
  ],
);
