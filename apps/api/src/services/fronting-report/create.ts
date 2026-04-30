import { frontingReports } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now, toUnixMillis } from "@pluralscape/types";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toFrontingReportResult } from "./internal.js";

import type { FrontingReportResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingReportId, SystemId } from "@pluralscape/types";
import type { CreateFrontingReportBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateFrontingReportBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const reportId = brandId<FrontingReportId>(createId(ID_PREFIXES.frontingReport));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(frontingReports)
      .values({
        id: reportId,
        systemId,
        encryptedData: blob,
        format: body.format,
        generatedAt: toUnixMillis(body.generatedAt),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting report — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-report.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting report created",
      systemId,
    });

    return toFrontingReportResult(row);
  });
}
