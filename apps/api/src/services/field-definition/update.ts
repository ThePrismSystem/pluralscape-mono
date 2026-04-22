import { fieldDefinitions } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateFieldDefinitionBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import {
  invalidateFieldDefCache,
  parseAndValidateFieldBlob,
  toFieldDefinitionResult,
} from "./internal.js";

import type { FieldDefinitionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateFieldDefinitionBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = parseAndValidateFieldBlob(parsed.data.encryptedData);
  const timestamp = now();

  const setClause: Partial<typeof fieldDefinitions.$inferInsert> = {
    encryptedData: blob,
    updatedAt: timestamp,
  };

  if (parsed.data.required !== undefined) {
    setClause.required = parsed.data.required;
  }
  if (parsed.data.sortOrder !== undefined) {
    setClause.sortOrder = parsed.data.sortOrder;
  }

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(fieldDefinitions)
      .set({
        ...setClause,
        version: sql`${fieldDefinitions.version} + 1`,
      })
      .where(
        and(
          eq(fieldDefinitions.id, fieldId),
          eq(fieldDefinitions.systemId, systemId),
          eq(fieldDefinitions.version, parsed.data.version),
          eq(fieldDefinitions.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
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
        return existing;
      },
      "Field definition",
    );

    await audit(tx, {
      eventType: "field-definition.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Field definition updated",
      systemId,
    });

    return toFieldDefinitionResult(row);
  });
  invalidateFieldDefCache();
  return result;
}
