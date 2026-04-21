import {
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
} from "@pluralscape/db/pg";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
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

    const [[valueCount], [visibilityCount], [scopeCount]] = await Promise.all([
      tx
        .select({ count: count() })
        .from(fieldValues)
        .where(and(eq(fieldValues.fieldDefinitionId, fieldId), eq(fieldValues.systemId, systemId))),
      tx
        .select({ count: count() })
        .from(fieldBucketVisibility)
        .where(
          and(
            eq(fieldBucketVisibility.fieldDefinitionId, fieldId),
            eq(fieldBucketVisibility.systemId, systemId),
          ),
        ),
      tx
        .select({ count: count() })
        .from(fieldDefinitionScopes)
        .where(
          and(
            eq(fieldDefinitionScopes.fieldDefinitionId, fieldId),
            eq(fieldDefinitionScopes.systemId, systemId),
          ),
        ),
    ]);

    if (!valueCount || !visibilityCount || !scopeCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    type FieldDefinitionDependentType = "fieldValues" | "bucketVisibility" | "scopes";
    const dependents: { type: FieldDefinitionDependentType; count: number }[] = [];
    if (valueCount.count > 0) dependents.push({ type: "fieldValues", count: valueCount.count });
    if (visibilityCount.count > 0)
      dependents.push({ type: "bucketVisibility", count: visibilityCount.count });
    if (scopeCount.count > 0) dependents.push({ type: "scopes", count: scopeCount.count });

    if (dependents.length > 0 && !force) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Field definition has dependents. Remove all dependents before deleting, or use force=true.",
        { dependents },
      );
    }

    // Cascade-delete dependents when force is enabled
    if (dependents.length > 0) {
      await Promise.all([
        valueCount.count > 0
          ? tx
              .delete(fieldValues)
              .where(
                and(eq(fieldValues.fieldDefinitionId, fieldId), eq(fieldValues.systemId, systemId)),
              )
          : Promise.resolve(),
        visibilityCount.count > 0
          ? tx
              .delete(fieldBucketVisibility)
              .where(
                and(
                  eq(fieldBucketVisibility.fieldDefinitionId, fieldId),
                  eq(fieldBucketVisibility.systemId, systemId),
                ),
              )
          : Promise.resolve(),
        scopeCount.count > 0
          ? tx
              .delete(fieldDefinitionScopes)
              .where(
                and(
                  eq(fieldDefinitionScopes.fieldDefinitionId, fieldId),
                  eq(fieldDefinitionScopes.systemId, systemId),
                ),
              )
          : Promise.resolve(),
      ]);
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
