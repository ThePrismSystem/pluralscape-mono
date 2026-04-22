import { relationships } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toRelationshipResult } from "./internal.js";

import type { RelationshipResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { RelationshipId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const RELATIONSHIP_LIFECYCLE = {
  table: relationships,
  columns: relationships,
  entityName: "Relationship",
  archiveEvent: "relationship.archived" as const,
  restoreEvent: "relationship.restored" as const,
};

export async function deleteRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify relationship exists
    const [existing] = await tx
      .select({ id: relationships.id })
      .from(relationships)
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Relationship not found");
    }

    // Audit before delete (FK satisfied since relationship still exists)
    await audit(tx, {
      eventType: "relationship.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship deleted",
      systemId,
    });

    // Hard delete
    await tx
      .delete(relationships)
      .where(and(eq(relationships.id, relationshipId), eq(relationships.systemId, systemId)));
  });
}

export async function archiveRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, relationshipId, auth, audit, RELATIONSHIP_LIFECYCLE);
}

export async function restoreRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  return restoreEntity(db, systemId, relationshipId, auth, audit, RELATIONSHIP_LIFECYCLE, (row) =>
    toRelationshipResult(row as typeof relationships.$inferSelect),
  );
}
