import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, gt } from "drizzle-orm";

import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT } from "../../../service.constants.js";

import { toEntityTypeResult, type EntityTypeResult } from "./internal.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { PaginatedResult, SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listEntityTypes(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<EntityTypeResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityTypes.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(systemStructureEntityTypes.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(
        gt(systemStructureEntityTypes.id, brandId<SystemStructureEntityTypeId>(opts.cursor)),
      );
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityTypes)
      .where(and(...conditions))
      .orderBy(systemStructureEntityTypes.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityTypeResult);
  });
}
