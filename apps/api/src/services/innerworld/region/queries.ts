import { innerworldRegions } from "@pluralscape/db/pg";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";

import { toRegionResult } from "./internal.js";

import type { RegionResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldRegionId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listRegions(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<RegionResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(innerworldRegions.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(innerworldRegions.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(innerworldRegions.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(innerworldRegions)
      .where(and(...conditions))
      .orderBy(innerworldRegions.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toRegionResult);
  });
}

export async function getRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    return toRegionResult(row);
  });
}
