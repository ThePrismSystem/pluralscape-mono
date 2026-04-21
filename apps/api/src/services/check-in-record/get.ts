import { checkInRecords } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toCheckInRecordResult } from "./internal.js";

import type { CheckInRecordResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function getCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(checkInRecords)
      .where(
        and(
          eq(checkInRecords.id, recordId),
          eq(checkInRecords.systemId, systemId),
          eq(checkInRecords.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    return toCheckInRecordResult(row);
  });
}
