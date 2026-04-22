import { innerworldEntities, innerworldRegions } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { checkDependents } from "../../../lib/check-dependents.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toRegionResult } from "./internal.js";

import type { RegionResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldRegionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldRegions.id })
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    // Cascade archive: collect all descendant region IDs
    const regionsToArchive = [regionId];
    let frontier = [regionId];

    while (frontier.length > 0) {
      const children = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            sql`${innerworldRegions.parentRegionId} IN (${sql.join(
              frontier.map((id) => sql`${id}`),
              sql`, `,
            )})`,
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        );

      frontier = children.map((c) => brandId<InnerWorldRegionId>(c.id));
      regionsToArchive.push(...frontier);
    }

    // Batch archive all collected regions
    await tx
      .update(innerworldRegions)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          inArray(innerworldRegions.id, regionsToArchive),
          eq(innerworldRegions.systemId, systemId),
        ),
      );

    // Batch archive all entities in any of the archived regions
    await tx
      .update(innerworldEntities)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          inArray(innerworldEntities.regionId, regionsToArchive),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      );

    await audit(tx, {
      eventType: "innerworld-region.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: `Region archived (cascade: ${String(regionsToArchive.length)} region(s))`,
      systemId,
    });
  });
}

export async function restoreRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldRegions.id, parentRegionId: innerworldRegions.parentRegionId })
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived region not found");
    }

    // If parent is archived, promote to root
    let newParentRegionId = existing.parentRegionId;
    if (newParentRegionId !== null) {
      const [parent] = await tx
        .select({ archived: innerworldRegions.archived })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, newParentRegionId),
            eq(innerworldRegions.systemId, systemId),
          ),
        )
        .limit(1);

      if (!parent || parent.archived) {
        newParentRegionId = null;
      }
    }

    const updated = await tx
      .update(innerworldRegions)
      .set({
        archived: false,
        archivedAt: null,
        parentRegionId: newParentRegionId,
        updatedAt: timestamp,
        version: sql`${innerworldRegions.version} + 1`,
      })
      .where(and(eq(innerworldRegions.id, regionId), eq(innerworldRegions.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived region not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "innerworld-region.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region restored",
      systemId,
    });

    return toRegionResult(row);
  });
}

export async function deleteRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify region exists
    const [existing] = await tx
      .select({ id: innerworldRegions.id })
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    // Check for non-archived child regions + non-archived entities
    const { dependents } = await checkDependents(tx, [
      {
        table: innerworldRegions,
        predicate: and(
          eq(innerworldRegions.parentRegionId, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
        typeName: "childRegions",
      },
      {
        table: innerworldEntities,
        predicate: and(
          eq(innerworldEntities.regionId, regionId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
        typeName: "entities",
      },
    ]);

    if (dependents.length > 0) {
      const children = dependents.find((d) => d.type === "childRegions")?.count ?? 0;
      const entities = dependents.find((d) => d.type === "entities")?.count ?? 0;
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Region has ${String(children)} child region(s) and ${String(entities)} entity/entities. Remove all dependents before deleting.`,
      );
    }

    // Audit before delete (FK satisfied since region still exists)
    await audit(tx, {
      eventType: "innerworld-region.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region deleted",
      systemId,
    });

    // Hard delete
    await tx
      .delete(innerworldRegions)
      .where(and(eq(innerworldRegions.id, regionId), eq(innerworldRegions.systemId, systemId)));
  });
}
