import {
  notes,
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
} from "@pluralscape/db/pg";
import { and, eq, or } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { checkDependents } from "../../../lib/check-dependents.js";
import { archiveEntity, restoreEntity } from "../../../lib/entity-lifecycle.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { ENTITY_LIFECYCLE, toStructureEntityResult } from "./internal.js";

import type { StructureEntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityId, auth, audit, ENTITY_LIFECYCLE);
}

export async function restoreStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  return restoreEntity(db, systemId, entityId, auth, audit, ENTITY_LIFECYCLE, (row) =>
    toStructureEntityResult(row as typeof systemStructureEntities.$inferSelect),
  );
}

export async function deleteStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntities.id })
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    // Check for dependents across all junction tables and notes
    const { dependents } = await checkDependents(tx, [
      {
        table: systemStructureEntityLinks,
        predicate: and(
          eq(systemStructureEntityLinks.systemId, systemId),
          or(
            eq(systemStructureEntityLinks.entityId, entityId),
            eq(systemStructureEntityLinks.parentEntityId, entityId),
          ),
        ),
        typeName: "entityLinks",
      },
      {
        table: systemStructureEntityMemberLinks,
        predicate: and(
          eq(systemStructureEntityMemberLinks.systemId, systemId),
          eq(systemStructureEntityMemberLinks.parentEntityId, entityId),
        ),
        typeName: "entityMemberLinks",
      },
      {
        table: systemStructureEntityAssociations,
        predicate: and(
          eq(systemStructureEntityAssociations.systemId, systemId),
          or(
            eq(systemStructureEntityAssociations.sourceEntityId, entityId),
            eq(systemStructureEntityAssociations.targetEntityId, entityId),
          ),
        ),
        typeName: "entityAssociations",
      },
      {
        table: notes,
        predicate: and(
          eq(notes.systemId, systemId),
          eq(notes.authorEntityType, "structure-entity"),
          eq(notes.authorEntityId, entityId),
        ),
        typeName: "notes",
      },
    ]);

    if (dependents.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Structure entity has dependents. Remove all dependents before deleting.",
        { dependents },
      );
    }

    await audit(tx, {
      eventType: "structure-entity.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
        ),
      );
  });
}
