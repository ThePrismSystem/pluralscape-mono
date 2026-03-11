import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type {
  DbChartData,
  DbDateRange,
  DbMemberFrontingBreakdown,
} from "../shared/analytics-types.js";
import type { ReportFormat } from "@pluralscape/types";

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
    format: varchar("format", { length: 255 }).notNull().$type<ReportFormat>(),
    generatedAt: pgTimestamp("generated_at").notNull(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
  ],
);
