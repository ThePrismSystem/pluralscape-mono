import { fieldValues } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { SetFieldValueBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
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

function ownerLabel(owner: FieldValueOwner): string {
  switch (owner.kind) {
    case "member":
      return "member";
    case "group":
      return "group";
    case "structureEntity":
      return "structure entity";
    default: {
      const _exhaustive: never = owner;
      throw new Error(`Unknown owner kind: ${(_exhaustive as FieldValueOwner).kind}`);
    }
  }
}

export async function setFieldValueForOwner(
  db: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
  fieldDefId: FieldDefinitionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldValueResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = SetFieldValueBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid set payload");
  }

  const blob = parseAndValidateValueBlob(parsed.data.encryptedData);
  const valueId = createId(ID_PREFIXES.fieldValue);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const ownerCols = await assertOwnerActiveAndGetColumns(tx, systemId, owner);
    await assertFieldDefinitionActive(tx, systemId, fieldDefId);

    const [existing] = await tx
      .select({ id: fieldValues.id })
      .from(fieldValues)
      .where(and(eq(fieldValues.fieldDefinitionId, fieldDefId), ownerWhereColumn(owner)))
      .limit(1);

    if (existing) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Field value already exists for this ${ownerLabel(owner)} and field definition`,
      );
    }

    const [row] = await tx
      .insert(fieldValues)
      .values({
        id: valueId,
        fieldDefinitionId: fieldDefId,
        ...ownerCols,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to set field value — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "field-value.set",
      actor: { kind: "account", id: auth.accountId },
      detail: `Field value set for definition ${fieldDefId}`,
      systemId,
    });

    return toFieldValueResult(row);
  });
}
