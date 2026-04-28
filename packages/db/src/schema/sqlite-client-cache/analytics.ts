import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  ChartData,
  DateRange,
  FrontingReportId,
  MemberFrontingBreakdown,
  ReportFormat,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `FrontingReport`. The server
 * keeps `dateRange`, `memberBreakdowns`, and `chartData` inside the
 * encrypted payload; the cache mirrors them as decrypted JSON columns
 * so the local UI can render reports without re-decrypting.
 * Reports are immutable once created (enforced at the API layer).
 */
export const frontingReports = sqliteTable("fronting_reports", {
  ...entityIdentity<FrontingReportId>(),
  dateRange: sqliteJsonOf<DateRange>("date_range").notNull(),
  memberBreakdowns: sqliteJsonOf<readonly MemberFrontingBreakdown[]>("member_breakdowns").notNull(),
  chartData: sqliteJsonOf<readonly ChartData[]>("chart_data").notNull(),
  format: text("format").$type<ReportFormat>().notNull(),
  generatedAt: sqliteTimestamp("generated_at").notNull(),
  ...timestamps(),
  ...archivable(),
});

export type LocalFrontingReportRow = InferSelectModel<typeof frontingReports>;
export type NewLocalFrontingReport = InferInsertModel<typeof frontingReports>;
