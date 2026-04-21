import { checkInRecords } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(checkInRecords)
      .set({
        archived: true,
        archivedAt: timestamp,
      })
      .where(
        and(
          eq(checkInRecords.id, recordId),
          eq(checkInRecords.systemId, systemId),
          eq(checkInRecords.archived, false),
        ),
      )
      .returning({ id: checkInRecords.id });

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: checkInRecords.id })
        .from(checkInRecords)
        .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
        .limit(1);

      if (existing) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Check-in record is already archived",
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    await audit(tx, {
      eventType: "check-in-record.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record archived",
      systemId,
    });
  });
}
