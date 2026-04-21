import { fieldDefinitions } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { invalidateFieldDefCache, toFieldDefinitionResult } from "./internal.js";

import type { FieldDefinitionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function restoreFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  assertSystemOwnership(systemId, auth);

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select()
      .from(fieldDefinitions)
      .where(
        and(
          eq(fieldDefinitions.id, fieldId),
          eq(fieldDefinitions.systemId, systemId),
          eq(fieldDefinitions.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
    }

    const timestamp = now();

    const [row] = await tx
      .update(fieldDefinitions)
      .set({ archived: false, archivedAt: null, updatedAt: timestamp })
      .where(and(eq(fieldDefinitions.id, fieldId), eq(fieldDefinitions.systemId, systemId)))
      .returning();

    if (!row) {
      throw new Error("Failed to restore field definition — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "field-definition.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Field definition restored",
      systemId,
    });

    return toFieldDefinitionResult(row);
  });
  invalidateFieldDefCache();
  return result;
}
