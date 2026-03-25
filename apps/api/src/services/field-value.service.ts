import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { fieldValues } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { SetFieldValueBodySchema, UpdateFieldValueBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertFieldDefinitionActive, assertMemberActive } from "../lib/member-helpers.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import { MAX_ENCRYPTED_FIELD_VALUE_BYTES } from "./field-value.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  FieldDefinitionId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface FieldValueResult {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toFieldValueResult(row: {
  id: string;
  fieldDefinitionId: string;
  memberId: string | null;
  structureEntityId: string | null;
  groupId: string | null;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): FieldValueResult {
  return {
    id: row.id as FieldValueId,
    fieldDefinitionId: row.fieldDefinitionId as FieldDefinitionId,
    memberId: row.memberId as MemberId | null,
    structureEntityId: row.structureEntityId as SystemStructureEntityId | null,
    groupId: row.groupId as GroupId | null,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

function parseAndValidateValueBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_FIELD_VALUE_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_FIELD_VALUE_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

// ── SET (CREATE) ────────────────────────────────────────────────────

export async function setFieldValue(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
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
    await assertMemberActive(tx, systemId, memberId);
    await assertFieldDefinitionActive(tx, systemId, fieldDefId);
    // Check for existing value (unique constraint)
    const [existing] = await tx
      .select({ id: fieldValues.id })
      .from(fieldValues)
      .where(and(eq(fieldValues.fieldDefinitionId, fieldDefId), eq(fieldValues.memberId, memberId)))
      .limit(1);

    if (existing) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        "Field value already exists for this member and field definition",
      );
    }

    const [row] = await tx
      .insert(fieldValues)
      .values({
        id: valueId,
        fieldDefinitionId: fieldDefId,
        memberId,
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

// ── LIST ────────────────────────────────────────────────────────────

export async function listFieldValues(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
): Promise<FieldValueResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertMemberActive(tx, systemId, memberId);

    const rows = await tx
      .select()
      .from(fieldValues)
      .where(and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId)));

    return rows.map(toFieldValueResult);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateFieldValue(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
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
    await assertMemberActive(tx, systemId, memberId);
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
          eq(fieldValues.memberId, memberId),
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
            eq(fieldValues.memberId, memberId),
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

// ── DELETE (hard delete) ────────────────────────────────────────────

export async function deleteFieldValue(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  fieldDefId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertMemberActive(tx, systemId, memberId);

    const deleted = await tx
      .delete(fieldValues)
      .where(
        and(
          eq(fieldValues.fieldDefinitionId, fieldDefId),
          eq(fieldValues.memberId, memberId),
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
