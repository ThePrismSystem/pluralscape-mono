import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { fieldValues } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { SetFieldValueBodySchema, UpdateFieldValueBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import {
  assertFieldDefinitionActive,
  assertGroupActive,
  assertMemberActive,
  assertStructureEntityActive,
} from "../lib/member-helpers.js";
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

// ── Owner discriminated union ──────────────────────────────────────

export type FieldValueOwner =
  | { readonly kind: "member"; readonly id: MemberId }
  | { readonly kind: "group"; readonly id: GroupId }
  | { readonly kind: "structureEntity"; readonly id: SystemStructureEntityId };

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

// ── Internal helpers ───────────────────────────────────────────────

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
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

/** Assert the owner entity is active and return the column assignments for the insert. */
async function assertOwnerActiveAndGetColumns(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
): Promise<{
  memberId: MemberId | undefined;
  groupId: GroupId | undefined;
  structureEntityId: SystemStructureEntityId | undefined;
}> {
  switch (owner.kind) {
    case "member":
      await assertMemberActive(tx, systemId, owner.id);
      return { memberId: owner.id, groupId: undefined, structureEntityId: undefined };
    case "group":
      await assertGroupActive(tx, systemId, owner.id);
      return { memberId: undefined, groupId: owner.id, structureEntityId: undefined };
    case "structureEntity":
      await assertStructureEntityActive(tx, systemId, owner.id);
      return { memberId: undefined, groupId: undefined, structureEntityId: owner.id };
    default: {
      const _exhaustive: never = owner;
      throw new Error(`Unknown owner kind: ${(_exhaustive as FieldValueOwner).kind}`);
    }
  }
}

/** Build the where-clause column condition for an owner. */
function ownerWhereColumn(owner: FieldValueOwner) {
  switch (owner.kind) {
    case "member":
      return eq(fieldValues.memberId, owner.id);
    case "group":
      return eq(fieldValues.groupId, owner.id);
    case "structureEntity":
      return eq(fieldValues.structureEntityId, owner.id);
    default: {
      const _exhaustive: never = owner;
      throw new Error(`Unknown owner kind: ${(_exhaustive as FieldValueOwner).kind}`);
    }
  }
}

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

// ── SET (CREATE) ────────────────────────────────────────────────────

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

// ── LIST ────────────────────────────────────────────────────────────

export async function listFieldValuesForOwner(
  db: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
  auth: AuthContext,
): Promise<FieldValueResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertOwnerActiveAndGetColumns(tx, systemId, owner);

    const rows = await tx
      .select()
      .from(fieldValues)
      .where(and(ownerWhereColumn(owner), eq(fieldValues.systemId, systemId)));

    return rows.map(toFieldValueResult);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

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

// ── DELETE (hard delete) ────────────────────────────────────────────

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
