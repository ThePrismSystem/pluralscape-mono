import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { fieldDefinitions, fieldValues } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import {
  CreateFieldDefinitionBodySchema,
  UpdateFieldDefinitionBodySchema,
} from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT } from "../routes/fields/fields.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  FieldDefinitionId,
  FieldType,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ───────────────────────────────────────────────────────

const MAX_FIELD_DEFINITIONS_PER_SYSTEM = 200;
const MAX_ENCRYPTED_FIELD_DATA_BYTES = 32_768;

// ── Types ───────────────────────────────────────────────────────────

export interface FieldDefinitionResult {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toFieldDefinitionResult(row: {
  id: string;
  systemId: string;
  fieldType: string;
  required: boolean;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): FieldDefinitionResult {
  return {
    id: row.id as FieldDefinitionId,
    systemId: row.systemId as SystemId,
    fieldType: row.fieldType as FieldType,
    required: row.required,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

function parseAndValidateFieldBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_FIELD_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_FIELD_DATA_BYTES)} bytes`,
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

// ── CREATE ──────────────────────────────────────────────────────────

export async function createFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  await assertSystemOwnership(db, systemId, auth);

  const parsed = CreateFieldDefinitionBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = parseAndValidateFieldBlob(parsed.data.encryptedData);
  const fieldId = createId(ID_PREFIXES.fieldDefinition);
  const timestamp = now();

  return db.transaction(async (tx) => {
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
        fieldType: parsed.data.fieldType,
        required: parsed.data.required,
        sortOrder: parsed.data.sortOrder,
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
      detail: `Field definition created (type: ${parsed.data.fieldType})`,
      systemId,
    });

    return toFieldDefinitionResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listFieldDefinitions(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: PaginationCursor;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<FieldDefinitionResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT);
  const conditions = [eq(fieldDefinitions.systemId, systemId)];

  if (!opts?.includeArchived) {
    conditions.push(eq(fieldDefinitions.archived, false));
  }

  if (opts?.cursor) {
    conditions.push(gt(fieldDefinitions.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(fieldDefinitions)
    .where(and(...conditions))
    .orderBy(fieldDefinitions.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toFieldDefinitionResult);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
): Promise<FieldDefinitionResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(fieldDefinitions)
    .where(
      and(
        eq(fieldDefinitions.id, fieldId),
        eq(fieldDefinitions.systemId, systemId),
        eq(fieldDefinitions.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
  }

  return toFieldDefinitionResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  await assertSystemOwnership(db, systemId, auth);

  const parsed = UpdateFieldDefinitionBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = parseAndValidateFieldBlob(parsed.data.encryptedData);
  const timestamp = now();

  const setClause: Record<string, unknown> = {
    encryptedData: blob,
    updatedAt: timestamp,
    version: sql`${fieldDefinitions.version} + 1`,
  };

  if (parsed.data.required !== undefined) {
    setClause.required = parsed.data.required;
  }
  if (parsed.data.sortOrder !== undefined) {
    setClause.sortOrder = parsed.data.sortOrder;
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(fieldDefinitions)
      .set(setClause)
      .where(
        and(
          eq(fieldDefinitions.id, fieldId),
          eq(fieldDefinitions.systemId, systemId),
          eq(fieldDefinitions.version, parsed.data.version),
          eq(fieldDefinitions.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
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

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "field-definition.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Field definition updated",
      systemId,
    });

    return toFieldDefinitionResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
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

    const timestamp = now();

    await audit(tx, {
      eventType: "field-definition.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Field definition archived",
      systemId,
    });

    await tx
      .update(fieldDefinitions)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(fieldDefinitions.id, fieldId), eq(fieldDefinitions.systemId, systemId)));
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldDefinitionResult> {
  await assertSystemOwnership(db, systemId, auth);

  return db.transaction(async (tx) => {
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
}

// ── DELETE ──────────────────────────────────────────────────────────

export async function deleteFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldId: FieldDefinitionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
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

    const [valueCount] = await tx
      .select({ count: count() })
      .from(fieldValues)
      .where(and(eq(fieldValues.fieldDefinitionId, fieldId), eq(fieldValues.systemId, systemId)));

    if (valueCount && valueCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Field definition has ${String(valueCount.count)} field value(s). Remove all values before deleting.`,
        { dependents: [{ type: "fieldValues", count: valueCount.count }] },
      );
    }

    await audit(tx, {
      eventType: "field-definition.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Field definition deleted",
      systemId,
    });

    await tx
      .delete(fieldDefinitions)
      .where(and(eq(fieldDefinitions.id, fieldId), eq(fieldDefinitions.systemId, systemId)));
  });
}
