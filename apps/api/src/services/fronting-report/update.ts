import { frontingReports } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
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
import type { UpdateFrontingReportBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  body: z.infer<typeof UpdateFrontingReportBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const version = body.version;
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
