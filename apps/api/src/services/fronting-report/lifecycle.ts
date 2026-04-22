import { frontingReports } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";

import { toFrontingReportResult } from "./internal.js";

import type { FrontingReportResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingReportId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const FRONTING_REPORT_LIFECYCLE = {
  table: frontingReports,
  columns: frontingReports,
  entityName: "Fronting report",
  archiveEvent: "fronting-report.archived" as const,
  restoreEvent: "fronting-report.restored" as const,
};

export async function archiveFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, reportId, auth, audit, FRONTING_REPORT_LIFECYCLE);
}

export async function restoreFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  return restoreEntity(db, systemId, reportId, auth, audit, FRONTING_REPORT_LIFECYCLE, (row) =>
    toFrontingReportResult(row as typeof frontingReports.$inferSelect),
  );
}
