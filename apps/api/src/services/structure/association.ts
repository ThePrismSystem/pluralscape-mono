import {
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
} from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateStructureEntityAssociationBodySchema } from "@pluralscape/validation";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_ANCESTOR_DEPTH, MAX_PAGE_LIMIT } from "../../service.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  PaginatedResult,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityAssociationResult {
  readonly id: SystemStructureEntityAssociationId;
  readonly systemId: SystemId;
  readonly sourceEntityId: SystemStructureEntityId;
  readonly targetEntityId: SystemStructureEntityId;
  readonly createdAt: UnixMillis;
}

export interface HierarchyNode {
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly depth: number;
}

// ── Row mapper ────────────────────────────────────────────────────

function toEntityAssociationResult(row: {
  id: string;
  systemId: string;
  sourceEntityId: string;
  targetEntityId: string;
  createdAt: number;
}): EntityAssociationResult {
  return {
    id: brandId<SystemStructureEntityAssociationId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    sourceEntityId: brandId<SystemStructureEntityId>(row.sourceEntityId),
    targetEntityId: brandId<SystemStructureEntityId>(row.targetEntityId),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ════════════════════════════════════════════════════════════════════
// Entity Associations (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityAssociation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityAssociationResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityAssociationBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const assocId = brandId<SystemStructureEntityAssociationId>(
    createId(ID_PREFIXES.structureEntityAssociation),
  );
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityAssociations)
      .values({
        id: assocId,
        systemId,
        sourceEntityId: parsed.data.sourceEntityId,
        targetEntityId: parsed.data.targetEntityId,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity association — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-association.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity association created",
      systemId,
    });

    return toEntityAssociationResult(row);
  });
}

export async function listEntityAssociations(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityAssociationResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityAssociations.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(
        gt(
          systemStructureEntityAssociations.id,
          brandId<SystemStructureEntityAssociationId>(opts.cursor),
        ),
      );
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityAssociations)
      .where(and(...conditions))
      .orderBy(systemStructureEntityAssociations.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityAssociationResult);
  });
}

export async function deleteEntityAssociation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  assocId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const assocIdBranded = brandId<SystemStructureEntityAssociationId>(assocId);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityAssociations.id })
      .from(systemStructureEntityAssociations)
      .where(
        and(
          eq(systemStructureEntityAssociations.id, assocIdBranded),
          eq(systemStructureEntityAssociations.systemId, systemId),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity association not found");
    }

    await audit(tx, {
      eventType: "structure-entity-association.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity association deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityAssociations)
      .where(
        and(
          eq(systemStructureEntityAssociations.id, assocIdBranded),
          eq(systemStructureEntityAssociations.systemId, systemId),
        ),
      );
  });
}

// ════════════════════════════════════════════════════════════════════
// Hierarchy
// ════════════════════════════════════════════════════════════════════

/**
 * Walk the entity link hierarchy using a recursive CTE, capped at
 * MAX_ANCESTOR_DEPTH to prevent runaway queries and detect cycles.
 */
export async function getEntityHierarchy(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
): Promise<readonly HierarchyNode[]> {
  assertSystemOwnership(systemId, auth);

  const entityIdBranded = brandId<SystemStructureEntityId>(entityId);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify entity exists
    const [entity] = await tx
      .select({ id: systemStructureEntities.id })
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityIdBranded),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1);

    if (!entity) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    const rows = await tx.execute<{
      entity_id: string;
      parent_entity_id: string | null;
      depth: number;
    }>(sql`
      WITH RECURSIVE hierarchy AS (
        SELECT
          ${systemStructureEntityLinks.entityId} AS entity_id,
          ${systemStructureEntityLinks.parentEntityId} AS parent_entity_id,
          1 AS depth
        FROM ${systemStructureEntityLinks}
        WHERE ${systemStructureEntityLinks.entityId} = ${entityId}
          AND ${systemStructureEntityLinks.systemId} = ${systemId}

        UNION ALL

        SELECT
          l.${sql.raw("entity_id")} AS entity_id,
          l.${sql.raw("parent_entity_id")} AS parent_entity_id,
          h.depth + 1 AS depth
        FROM ${systemStructureEntityLinks} l
        INNER JOIN hierarchy h ON l.${sql.raw("entity_id")} = h.parent_entity_id
        WHERE l.${sql.raw("system_id")} = ${systemId}
          AND h.depth < ${MAX_ANCESTOR_DEPTH}
      )
      SELECT entity_id, parent_entity_id, depth FROM hierarchy
      ORDER BY depth ASC
    `);

    return rows.map((r) => ({
      entityId: brandId<SystemStructureEntityId>(r.entity_id),
      parentEntityId: r.parent_entity_id
        ? brandId<SystemStructureEntityId>(r.parent_entity_id)
        : null,
      depth: r.depth,
    }));
  });
}
