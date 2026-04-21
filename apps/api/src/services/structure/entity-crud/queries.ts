import { systemStructureEntities } from "@pluralscape/db/pg";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT } from "../../../service.constants.js";

import { toStructureEntityResult } from "./internal.js";

import type { StructureEntityResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listStructureEntities(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
    entityTypeId?: SystemStructureEntityTypeId;
  },
): Promise<PaginatedResult<StructureEntityResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntities.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(systemStructureEntities.archived, false));
    }

    if (opts?.entityTypeId) {
      conditions.push(eq(systemStructureEntities.entityTypeId, opts.entityTypeId));
    }

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntities.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntities)
      .where(and(...conditions))
      .orderBy(systemStructureEntities.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toStructureEntityResult);
  });
}

export async function getStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    return toStructureEntityResult(row);
  });
}
