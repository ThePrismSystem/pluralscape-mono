import { fieldDefinitions } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_FIELD_DEFINITIONS_PER_SYSTEM } from "../../quota.constants.js";

import {
  invalidateFieldDefCache,
  parseAndValidateFieldBlob,
  toFieldDefinitionResult,
} from "./internal.js";

import type { FieldDefinitionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { CreateFieldDefinitionBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateFieldDefinitionBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  assertSystemOwnership(systemId, auth);

  const blob = parseAndValidateFieldBlob(body.encryptedData);
  const fieldId = brandId<FieldDefinitionId>(createId(ID_PREFIXES.fieldDefinition));
  const timestamp = now();

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Check quota inside transaction to prevent TOCTOU races
    const [countResult] = await tx
      .select({ count: count() })
      .from(fieldDefinitions)
      .where(and(eq(fieldDefinitions.systemId, systemId), eq(fieldDefinitions.archived, false)));

    if ((countResult?.count ?? 0) >= MAX_FIELD_DEFINITIONS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_FIELD_DEFINITIONS_PER_SYSTEM)} field definitions per system`,
      );
    }

    const [row] = await tx
      .insert(fieldDefinitions)
      .values({
        id: fieldId,
        systemId,
        fieldType: body.fieldType,
        required: body.required,
        sortOrder: body.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create field definition — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "field-definition.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Field definition created (type: ${body.fieldType})`,
      systemId,
    });

    return toFieldDefinitionResult(row);
  });
  invalidateFieldDefCache();
  return result;
}
