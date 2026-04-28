import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import type { FrontingReportId, ReportFormat } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const frontingReports = sqliteTable(
  "fronting_reports",
  {
    ...entityIdentity<FrontingReportId>(),
    ...encryptedPayload(),
    format: text("format").notNull().$type<ReportFormat>(),
    generatedAt: sqliteTimestamp("generated_at").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
    ...serverEntityChecks("fronting_reports", t),
  ],
);

export type FrontingReportRow = InferSelectModel<typeof frontingReports>;
export type NewFrontingReport = InferInsertModel<typeof frontingReports>;
