import { checkInRecords } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { CheckInRecordQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toCheckInRecordResult } from "./internal.js";

import type { CheckInRecordListOptions, CheckInRecordResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listCheckInRecords(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: CheckInRecordListOptions = {},
): Promise<PaginatedResult<CheckInRecordResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(checkInRecords.systemId, systemId)];

    if (opts.timerConfigId) {
      conditions.push(eq(checkInRecords.timerConfigId, opts.timerConfigId));
    }

    if (opts.pending) {
      conditions.push(isNull(checkInRecords.respondedAt));
      conditions.push(eq(checkInRecords.dismissed, false));
      conditions.push(eq(checkInRecords.archived, false));
    } else if (!opts.includeArchived) {
      conditions.push(eq(checkInRecords.archived, false));
    }

    if (opts.cursor) {
      conditions.push(lt(checkInRecords.id, brandId<CheckInRecordId>(opts.cursor)));
    }

    const rows = await tx
      .select()
      .from(checkInRecords)
      .where(and(...conditions))
      .orderBy(desc(checkInRecords.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toCheckInRecordResult);
  });
}

export function parseCheckInRecordQuery(
  query: Record<string, string | undefined>,
): CheckInRecordListOptions {
  const result = CheckInRecordQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
