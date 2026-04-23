import { innerworldEntities } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";

import { toEntityResult } from "./internal.js";

import type { EntityResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  InnerWorldEntityId,
  InnerWorldRegionId,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listEntities(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    regionId?: InnerWorldRegionId;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<EntityResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(innerworldEntities.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(innerworldEntities.archived, false));
    }

    if (opts?.regionId) {
      conditions.push(eq(innerworldEntities.regionId, opts.regionId));
    }

    if (opts?.cursor) {
      conditions.push(gt(innerworldEntities.id, brandId<InnerWorldEntityId>(opts.cursor)));
    }

    const rows = await tx
      .select()
      .from(innerworldEntities)
      .where(and(...conditions))
      .orderBy(innerworldEntities.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toEntityResult);
  });
}

export async function getEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Entity not found");
    }

    return toEntityResult(row);
  });
}
