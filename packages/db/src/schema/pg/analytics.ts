import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import type { FrontingReportId, ReportFormat } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const frontingReports = pgTable(
  "fronting_reports",
  {
    ...entityIdentity<FrontingReportId>(),
    ...encryptedPayload(),
    format: varchar("format", { length: ENUM_MAX_LENGTH }).notNull().$type<ReportFormat>(),
    generatedAt: pgTimestamp("generated_at").notNull(),
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
