import { fieldDefinitions } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, gt } from "drizzle-orm";

import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT } from "../../routes/fields/fields.constants.js";

import { fieldDefCache, listCacheKey, toFieldDefinitionResult } from "./internal.js";

import type { FieldDefinitionResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listFieldDefinitions(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<FieldDefinitionResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT);
  const cacheKey = listCacheKey(systemId, opts?.cursor, limit, opts?.includeArchived);
  const cached = fieldDefCache.get(cacheKey);
  if (cached) return cached;

  const result = await withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(fieldDefinitions.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(fieldDefinitions.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(fieldDefinitions.id, brandId<FieldDefinitionId>(opts.cursor)));
    }

    const rows = await tx
      .select()
      .from(fieldDefinitions)
      .where(and(...conditions))
      .orderBy(fieldDefinitions.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toFieldDefinitionResult);
  });
  fieldDefCache.set(cacheKey, result);
  return result;
}
