import { fieldValues } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { assertOwnerActiveAndGetColumns, ownerWhereColumn } from "./internal.js";

import type { FieldValueOwner } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteFieldValueForOwner(
  db: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
  fieldDefId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertOwnerActiveAndGetColumns(tx, systemId, owner);

    const deleted = await tx
      .delete(fieldValues)
      .where(
        and(
          eq(fieldValues.fieldDefinitionId, fieldDefId),
          ownerWhereColumn(owner),
          eq(fieldValues.systemId, systemId),
        ),
      )
      .returning({ id: fieldValues.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field value not found");
    }

    await audit(tx, {
      eventType: "field-value.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: `Field value deleted for definition ${fieldDefId}`,
      systemId,
    });
  });
}
