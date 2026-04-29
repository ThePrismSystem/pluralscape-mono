import { checkInRecords, members } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { RespondCheckInRecordBodySchema } from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
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

export async function respondCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  const parseResult = RespondCheckInRecordBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const { respondedByMemberId } = parseResult.data;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await fetchPendingCheckIn(tx, recordId, systemId);

    // Validate member exists in this system
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, respondedByMemberId), eq(members.systemId, systemId)))
      .limit(1);

    if (!member) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Member not found in system");
    }

    // State guards in WHERE prevent concurrent overwrites
    const [row] = await tx
      .update(checkInRecords)
      .set({
        respondedByMemberId,
        respondedAt: timestamp,
      })
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
      eventType: "check-in-record.responded",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record responded",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}
