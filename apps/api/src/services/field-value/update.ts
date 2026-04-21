import { fieldValues } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateFieldValueBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { assertFieldDefinitionActive } from "../../lib/member-helpers.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import {
  assertOwnerActiveAndGetColumns,
  ownerWhereColumn,
  parseAndValidateValueBlob,
  toFieldValueResult,
} from "./internal.js";

import type { FieldValueOwner, FieldValueResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateFieldValueForOwner(
  db: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
  fieldDefId: FieldDefinitionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldValueResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateFieldValueBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = parseAndValidateValueBlob(parsed.data.encryptedData);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertOwnerActiveAndGetColumns(tx, systemId, owner);
    await assertFieldDefinitionActive(tx, systemId, fieldDefId);

    const updated = await tx
      .update(fieldValues)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${fieldValues.version} + 1`,
      })
      .where(
        and(
          eq(fieldValues.fieldDefinitionId, fieldDefId),
          ownerWhereColumn(owner),
          eq(fieldValues.systemId, systemId),
          eq(fieldValues.version, parsed.data.version),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: fieldValues.id })
        .from(fieldValues)
        .where(
          and(
            eq(fieldValues.fieldDefinitionId, fieldDefId),
            ownerWhereColumn(owner),
            eq(fieldValues.systemId, systemId),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field value not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "field-value.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Field value updated for definition ${fieldDefId}`,
      systemId,
    });

    return toFieldValueResult(row);
  });
}
