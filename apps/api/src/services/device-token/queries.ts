import { deviceTokens } from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import {
  DEFAULT_DEVICE_TOKEN_LIMIT,
  MAX_DEVICE_TOKENS_PER_LIST,
} from "../device-token.constants.js";

import { toDeviceTokenResult } from "./internal.js";

import type { DeviceTokenResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** List all non-revoked device tokens for a system, newest first. */
export async function listDeviceTokens(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: { cursor?: string; limit?: number },
): Promise<PaginatedResult<DeviceTokenResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_DEVICE_TOKEN_LIMIT, MAX_DEVICE_TOKENS_PER_LIST);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(deviceTokens.systemId, systemId), isNull(deviceTokens.revokedAt)];

    if (opts?.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "dt");
      const sortValue = toUnixMillis(decoded.sortValue);
      const cursorCondition = or(
        lt(deviceTokens.createdAt, sortValue),
        and(eq(deviceTokens.createdAt, sortValue), lt(deviceTokens.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(deviceTokens)
      .where(and(...conditions))
      .orderBy(desc(deviceTokens.createdAt), desc(deviceTokens.id))
      .limit(limit + 1);

    return buildCompositePaginatedResult(
      rows,
      limit,
      (row) => toDeviceTokenResult(row),
      (item) => item.createdAt,
    );
  });
}
