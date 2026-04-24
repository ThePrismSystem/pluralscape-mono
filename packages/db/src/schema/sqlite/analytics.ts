import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_REPORT_FORMATS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { FrontingReportId, ReportFormat, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const frontingReports = sqliteTable(
  "fronting_reports",
  {
    id: brandedId<FrontingReportId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    format: text("format").notNull().$type<ReportFormat>(),
    generatedAt: sqliteTimestamp("generated_at").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("fronting_reports_system_id_idx").on(t.systemId),
    check("fronting_reports_format_check", enumCheck(t.format, FRONTING_REPORT_FORMATS)),
    versionCheckFor("fronting_reports", t.version),
    archivableConsistencyCheckFor("fronting_reports", t.archived, t.archivedAt),
  ],
);

export type FrontingReportRow = InferSelectModel<typeof frontingReports>;
export type NewFrontingReport = InferInsertModel<typeof frontingReports>;
