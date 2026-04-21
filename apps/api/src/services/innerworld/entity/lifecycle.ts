import { innerworldEntities, innerworldRegions } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { archiveEntity as archiveEntityGeneric } from "../../../lib/entity-lifecycle.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toEntityResult } from "./internal.js";

import type { EntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldEntityId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const INNERWORLD_ENTITY_LIFECYCLE = {
  table: innerworldEntities,
  columns: innerworldEntities,
  entityName: "Entity",
  archiveEvent: "innerworld-entity.archived" as const,
  restoreEvent: "innerworld-entity.restored" as const,
};

export async function archiveEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntityGeneric(db, systemId, entityId, auth, audit, INNERWORLD_ENTITY_LIFECYCLE);
}

export async function restoreEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldEntities.id, regionId: innerworldEntities.regionId })
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived entity not found");
    }

    // If entity's region is archived, set regionId to null
    let newRegionId = existing.regionId;
    if (newRegionId !== null) {
      const [region] = await tx
        .select({ archived: innerworldRegions.archived })
        .from(innerworldRegions)
        .where(and(eq(innerworldRegions.id, newRegionId), eq(innerworldRegions.systemId, systemId)))
        .limit(1);

      if (!region || region.archived) {
        newRegionId = null;
      }
    }

    const updated = await tx
      .update(innerworldEntities)
      .set({
        archived: false,
        archivedAt: null,
        regionId: newRegionId,
        updatedAt: timestamp,
        version: sql`${innerworldEntities.version} + 1`,
      })
      .where(and(eq(innerworldEntities.id, entityId), eq(innerworldEntities.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived entity not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "innerworld-entity.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity restored",
      systemId,
    });

    return toEntityResult(row);
  });
}

export async function deleteEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldEntities.id })
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Entity not found");
    }

    // Audit before delete (FK satisfied since entity still exists)
    await audit(tx, {
      eventType: "innerworld-entity.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity deleted",
      systemId,
    });

    // Hard delete — no HAS_DEPENDENTS check for entities
    await tx
      .delete(innerworldEntities)
      .where(and(eq(innerworldEntities.id, entityId), eq(innerworldEntities.systemId, systemId)));
  });
}
