import {
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
} from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { invalidateFieldDefCache } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
  opts?: { force?: boolean },
): Promise<void> {
  assertSystemOwnership(systemId, auth);
  const force = opts?.force === true;

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(
        and(
          eq(fieldDefinitions.id, fieldId),
          eq(fieldDefinitions.systemId, systemId),
          eq(fieldDefinitions.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
    }

    const { dependents } = await checkDependents(tx, [
      {
        table: fieldValues,
        predicate: and(
          eq(fieldValues.fieldDefinitionId, fieldId),
          eq(fieldValues.systemId, systemId),
        ),
        typeName: "fieldValues",
      },
      {
        table: fieldBucketVisibility,
        predicate: and(
          eq(fieldBucketVisibility.fieldDefinitionId, fieldId),
          eq(fieldBucketVisibility.systemId, systemId),
        ),
        typeName: "bucketVisibility",
      },
      {
        table: fieldDefinitionScopes,
        predicate: and(
          eq(fieldDefinitionScopes.fieldDefinitionId, fieldId),
          eq(fieldDefinitionScopes.systemId, systemId),
        ),
        typeName: "scopes",
      },
    ]);

    if (dependents.length > 0 && !force) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Field definition has dependents. Remove all dependents before deleting, or use force=true.",
        { dependents },
      );
    }

    // Cascade-delete present dependents in parallel when force is enabled.
    // `dep.type` is narrowed to the literal union of typeNames above via the
    // const-generic `checkDependents`, so the switch is exhaustively checked.
    if (dependents.length > 0) {
      await Promise.all(
        dependents.map((dep) => {
          switch (dep.type) {
            case "fieldValues":
              return tx
                .delete(fieldValues)
                .where(
                  and(
                    eq(fieldValues.fieldDefinitionId, fieldId),
                    eq(fieldValues.systemId, systemId),
                  ),
                );
            case "bucketVisibility":
              return tx
                .delete(fieldBucketVisibility)
                .where(
                  and(
                    eq(fieldBucketVisibility.fieldDefinitionId, fieldId),
                    eq(fieldBucketVisibility.systemId, systemId),
                  ),
                );
            case "scopes":
              return tx
                .delete(fieldDefinitionScopes)
                .where(
                  and(
                    eq(fieldDefinitionScopes.fieldDefinitionId, fieldId),
                    eq(fieldDefinitionScopes.systemId, systemId),
                  ),
                );
            default: {
              const _exhaustive: never = dep.type;
              throw new Error(`Unknown dependent type: ${String(_exhaustive)}`);
            }
          }
        }),
      );
    }

    const detail =
      force && dependents.length > 0
        ? `Field definition force-deleted (removed ${dependents.map((d) => `${String(d.count)} ${d.type}`).join(", ")})`
        : "Field definition deleted";

    await audit(tx, {
      eventType: "field-definition.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail,
      systemId,
    });

    await tx.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldId));
  });
  invalidateFieldDefCache();
}
