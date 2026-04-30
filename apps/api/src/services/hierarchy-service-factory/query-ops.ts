import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  HierarchyCreateBody,
  HierarchyServiceConfig,
  HierarchyUpdateBody,
} from "../hierarchy-service-types.js";
import type { PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listEntities<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  includeArchived = false,
): Promise<PaginatedResult<TResult>> {
  const { table, columns, toResult } = cfg;

  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(columns.systemId, systemId)];

    if (!includeArchived) {
      conditions.push(eq(columns.archived, false));
    }

    if (cursor) {
      conditions.push(gt(columns.id, cursor));
    }

    const rows = await tx
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(columns.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, (row) => toResult(row as TRow));
  });
}

export async function getEntity<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
): Promise<TResult> {
  const { table, columns, entityName, toResult } = cfg;

  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(table)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, false)),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
    }

    return toResult(row as TRow);
  });
}
