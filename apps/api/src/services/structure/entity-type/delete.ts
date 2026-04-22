import { systemStructureEntities, systemStructureEntityTypes } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { checkDependents } from "../../../lib/check-dependents.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityTypes.id })
      .from(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity type not found");
    }

    // Check for entities referencing this type
    const { dependents } = await checkDependents(tx, [
      {
        table: systemStructureEntities,
        predicate: and(
          eq(systemStructureEntities.entityTypeId, entityTypeId),
          eq(systemStructureEntities.systemId, systemId),
        ),
        typeName: "structureEntities",
      },
    ]);

    const [entityDep] = dependents;
    if (entityDep) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Structure entity type has ${String(entityDep.count)} entity(s). Remove all entities before deleting.`,
        { dependents: [entityDep] },
      );
    }

    await audit(tx, {
      eventType: "structure-entity-type.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
        ),
      );
  });
}
