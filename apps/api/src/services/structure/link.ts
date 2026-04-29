import { systemStructureEntityLinks } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import {
  CreateStructureEntityLinkBodySchema,
  UpdateStructureEntityLinkBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
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
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityLinkResult {
  readonly id: SystemStructureEntityLinkId;
  readonly systemId: SystemId;
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

// ── UPDATE ────────────────────────────────────────────────────────

export async function updateEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateStructureEntityLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const linkIdBranded = brandId<SystemStructureEntityLinkId>(linkId);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityLinks.id })
      .from(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkIdBranded),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity link not found");
    }

    const [row] = await tx
      .update(systemStructureEntityLinks)
      .set({ sortOrder: parsed.data.sortOrder })
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkIdBranded),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error("Failed to update entity link — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-link.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link updated",
      systemId,
    });

    return toEntityLinkResult(row);
  });
}

// ── Row mapper ────────────────────────────────────────────────────

function toEntityLinkResult(row: {
  id: string;
  systemId: string;
  entityId: string;
  parentEntityId: string | null;
  sortOrder: number;
  createdAt: number;
}): EntityLinkResult {
  return {
    id: brandId<SystemStructureEntityLinkId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    entityId: brandId<SystemStructureEntityId>(row.entityId),
    parentEntityId: row.parentEntityId
      ? brandId<SystemStructureEntityId>(row.parentEntityId)
      : null,
    sortOrder: row.sortOrder,
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ════════════════════════════════════════════════════════════════════
// Entity Links (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const { entityId, parentEntityId, sortOrder } = parsed.data;

  if (entityId === parentEntityId) {
    throw new ApiHttpError(HTTP_CONFLICT, "CYCLE_DETECTED", "Cannot link entity to itself");
  }

  const linkId = brandId<SystemStructureEntityLinkId>(createId(ID_PREFIXES.structureEntityLink));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    if (parentEntityId !== null) {
      const ancestorResult = await tx.execute<{ count: string }>(sql`
        WITH RECURSIVE ancestors AS (
          SELECT entity_id, parent_entity_id FROM system_structure_entity_links
          WHERE entity_id = ${parentEntityId} AND system_id = ${systemId}
          UNION ALL
          SELECT l.entity_id, l.parent_entity_id FROM system_structure_entity_links l
          INNER JOIN ancestors a ON l.entity_id = a.parent_entity_id
          WHERE l.system_id = ${systemId}
        )
        SELECT COUNT(*) AS count FROM ancestors WHERE parent_entity_id = ${entityId}
      `);

      const cycleRow: { count: string } | undefined = ancestorResult[0];
      const cycleCount = Number(cycleRow?.count ?? 0);
      if (cycleCount > 0) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "CYCLE_DETECTED",
          "Creating this link would form a cycle",
        );
      }

      const depthResult = await tx.execute<{ count: string }>(sql`
        WITH RECURSIVE ancestors AS (
          SELECT entity_id, parent_entity_id FROM system_structure_entity_links
          WHERE entity_id = ${parentEntityId} AND system_id = ${systemId}
          UNION ALL
          SELECT l.entity_id, l.parent_entity_id FROM system_structure_entity_links l
          INNER JOIN ancestors a ON l.entity_id = a.parent_entity_id
          WHERE l.system_id = ${systemId}
        )
        SELECT COUNT(*) AS count FROM ancestors
      `);

      const depthRow: { count: string } | undefined = depthResult[0];
      const ancestorCount = Number(depthRow?.count ?? 0);
      if (ancestorCount >= MAX_ANCESTOR_DEPTH) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "MAX_DEPTH_EXCEEDED",
          "Maximum nesting depth exceeded",
        );
      }
    }

    const [row] = await tx
      .insert(systemStructureEntityLinks)
      .values({
        id: linkId,
        systemId,
        entityId,
        parentEntityId,
        sortOrder,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity link — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-link.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link created",
      systemId,
    });

    return toEntityLinkResult(row);
  });
}

export async function listEntityLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityLinkResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityLinks.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(
        gt(systemStructureEntityLinks.id, brandId<SystemStructureEntityLinkId>(opts.cursor)),
      );
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityLinks)
      .where(and(...conditions))
      .orderBy(systemStructureEntityLinks.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityLinkResult);
  });
}

export async function deleteEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const linkIdBranded = brandId<SystemStructureEntityLinkId>(linkId);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityLinks.id })
      .from(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkIdBranded),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity link not found");
    }

    await audit(tx, {
      eventType: "structure-entity-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkIdBranded),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      );
  });
}
