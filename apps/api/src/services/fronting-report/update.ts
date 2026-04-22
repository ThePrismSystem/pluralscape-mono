import { frontingReports } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateFrontingReportBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toFrontingReportResult } from "./internal.js";

import type { FrontingReportResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingReportId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateFrontingReportBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingReports)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${frontingReports.version} + 1`,
      })
      .where(
        and(
          eq(frontingReports.id, reportId),
          eq(frontingReports.systemId, systemId),
          eq(frontingReports.version, version),
          eq(frontingReports.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingReports.id })
          .from(frontingReports)
          .where(
            and(
              eq(frontingReports.id, reportId),
              eq(frontingReports.systemId, systemId),
              eq(frontingReports.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting report",
    );

    await audit(tx, {
      eventType: "fronting-report.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting report updated",
      systemId,
    });

    return toFrontingReportResult(row);
  });
}
