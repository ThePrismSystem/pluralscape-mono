import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { customFronts, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { CreateCustomFrontBodySchema, UpdateCustomFrontBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
} from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import {
  DEFAULT_CUSTOM_FRONT_LIMIT,
  MAX_CUSTOM_FRONT_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
} from "../routes/custom-fronts/custom-fronts.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  CustomFrontId,
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface CustomFrontResult {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function encryptedBlobToBase64(blob: EncryptedBlob): string {
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64");
}

function toCustomFrontResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): CustomFrontResult {
  return {
    id: row.id as CustomFrontId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

function assertSystemOwnership(auth: AuthContext, systemId: SystemId): void {
  if (auth.systemId !== systemId) {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "System access denied");
  }
}

function parseAndValidateBlob(
  params: unknown,
  schema: typeof CreateCustomFrontBodySchema | typeof UpdateCustomFrontBodySchema,
): { parsed: { encryptedData: string; version?: number }; blob: EncryptedBlob } {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const rawBytes = Buffer.from(result.data.encryptedData, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  return { parsed: result.data, blob };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  assertSystemOwnership(auth, systemId);

  const { blob } = parseAndValidateBlob(params, CreateCustomFrontBodySchema);

  const cfId = createId(ID_PREFIXES.customFront);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customFronts)
      .values({
        id: cfId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create custom front — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "custom-front.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front created",
      systemId,
    });

    return toCustomFrontResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listCustomFronts(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_CUSTOM_FRONT_LIMIT,
): Promise<PaginatedResult<CustomFrontResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_CUSTOM_FRONT_LIMIT);

  const conditions = [eq(customFronts.systemId, systemId), eq(customFronts.archived, false)];

  if (cursor) {
    conditions.push(gt(customFronts.id, cursor));
  }

  const rows = await db
    .select()
    .from(customFronts)
    .where(and(...conditions))
    .orderBy(customFronts.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toCustomFrontResult);
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

export async function getCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
): Promise<CustomFrontResult> {
  assertSystemOwnership(auth, systemId);

  const [row] = await db
    .select()
    .from(customFronts)
    .where(
      and(
        eq(customFronts.id, customFrontId),
        eq(customFronts.systemId, systemId),
        eq(customFronts.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Custom front not found");
  }

  return toCustomFrontResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  assertSystemOwnership(auth, systemId);

  const { parsed, blob } = parseAndValidateBlob(params, UpdateCustomFrontBodySchema);
  const version = parsed.version as number;
  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(customFronts)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${customFronts.version} + 1`,
      })
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.version, version),
          eq(customFronts.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: customFronts.id })
        .from(customFronts)
        .where(
          and(
            eq(customFronts.id, customFrontId),
            eq(customFronts.systemId, systemId),
            eq(customFronts.archived, false),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Custom front not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "custom-front.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front updated",
      systemId,
    });

    return toCustomFrontResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customFronts.id })
      .from(customFronts)
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Custom front not found");
    }

    // Check for fronting sessions referencing this custom front
    const [sessionCount] = await tx
      .select({ count: count() })
      .from(frontingSessions)
      .where(eq(frontingSessions.customFrontId, customFrontId));

    if ((sessionCount?.count ?? 0) > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Custom front has ${String(sessionCount?.count ?? 0)} fronting session(s). Archive instead of deleting.`,
      );
    }

    await audit(tx, {
      eventType: "custom-front.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front deleted",
      systemId,
    });

    await tx
      .delete(customFronts)
      .where(and(eq(customFronts.id, customFrontId), eq(customFronts.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customFronts.id })
      .from(customFronts)
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Custom front not found");
    }

    await tx
      .update(customFronts)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(customFronts.id, customFrontId), eq(customFronts.systemId, systemId)));

    await audit(tx, {
      eventType: "custom-front.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customFronts.id })
      .from(customFronts)
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived custom front not found");
    }

    const updated = await tx
      .update(customFronts)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${customFronts.version} + 1`,
      })
      .where(and(eq(customFronts.id, customFrontId), eq(customFronts.systemId, systemId)))
      .returning();

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "custom-front.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front restored",
      systemId,
    });

    return toCustomFrontResult(row);
  });
}
