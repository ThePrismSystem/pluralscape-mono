import { checkInRecords } from "@pluralscape/db/pg";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { fetchPendingCheckIn, toCheckInRecordResult } from "./internal.js";

import type { CheckInRecordResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function dismissCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await fetchPendingCheckIn(tx, recordId, systemId);

    // State guards in WHERE prevent concurrent overwrites
    const [row] = await tx
      .update(checkInRecords)
      .set({ dismissed: true })
      .where(
        and(
          eq(checkInRecords.id, recordId),
          eq(checkInRecords.systemId, systemId),
          isNull(checkInRecords.respondedAt),
          eq(checkInRecords.dismissed, false),
        ),
      )
      .returning();

    if (!row) {
      // Re-query to determine the correct conflict code
      const [current] = await tx
        .select()
        .from(checkInRecords)
        .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
        .limit(1);

      if (current?.respondedAt !== null) {
        throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_RESPONDED", "Check-in already responded");
      }
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_DISMISSED", "Check-in already dismissed");
    }

    await audit(tx, {
      eventType: "check-in-record.dismissed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record dismissed",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}
