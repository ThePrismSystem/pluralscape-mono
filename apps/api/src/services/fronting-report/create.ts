import { frontingReports } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateFrontingReportBodySchema } from "@pluralscape/validation";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
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

export async function createFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateFrontingReportBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const reportId = brandId<FrontingReportId>(createId(ID_PREFIXES.frontingReport));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(frontingReports)
      .values({
        id: reportId,
        systemId,
        encryptedData: blob,
        format: parsed.format,
        generatedAt: toUnixMillis(parsed.generatedAt),
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
