import { relationships } from "@pluralscape/db/pg";
import { and, eq, gt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toRelationshipResult } from "./internal.js";

import type { RelationshipResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  PaginatedResult,
  RelationshipId,
  RelationshipType,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listRelationships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  memberId?: string,
  type?: RelationshipType,
): Promise<PaginatedResult<RelationshipResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(relationships.systemId, systemId), eq(relationships.archived, false)];

    if (cursor) {
      conditions.push(gt(relationships.id, cursor));
    }

    if (memberId) {
      const memberFilter = or(
        eq(relationships.sourceMemberId, memberId),
        eq(relationships.targetMemberId, memberId),
      );
      if (memberFilter) {
        conditions.push(memberFilter);
      }
    }

    if (type) {
      conditions.push(eq(relationships.type, type));
    }

    const rows = await tx
      .select()
      .from(relationships)
      .where(and(...conditions))
      .orderBy(relationships.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toRelationshipResult);
  });
}

export async function getRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Relationship not found");
    }

    return toRelationshipResult(row);
  });
}
