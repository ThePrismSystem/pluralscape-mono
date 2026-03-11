import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type {
  DbChartData,
  DbDateRange,
  DbMemberFrontingBreakdown,
} from "../shared/analytics-types.js";
import type { ReportFormat } from "@pluralscape/types";

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
    format: text("format").notNull().$type<ReportFormat>(),
    generatedAt: sqliteTimestamp("generated_at").notNull(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
  ],
);
