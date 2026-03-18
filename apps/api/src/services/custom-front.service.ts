import { customFronts, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateCustomFrontBodySchema, UpdateCustomFrontBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

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

// ── CREATE ──────────────────────────────────────────────────────────

export async function createCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { blob } = parseAndValidateBlob(
    params,
    CreateCustomFrontBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

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
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<CustomFrontResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

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

  return buildPaginatedResult(rows, effectiveLimit, toCustomFrontResult);
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
): Promise<CustomFrontResult> {
  await assertSystemOwnership(db, systemId, auth);

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
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateCustomFrontBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
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

    const row = await assertOccUpdated(
      updated,
      async () => {
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
        return existing;
      },
      "Custom front",
    );

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
  await assertSystemOwnership(db, systemId, auth);

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

    if (!sessionCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (sessionCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Custom front has ${String(sessionCount.count)} fronting session(s). Archive instead of deleting.`,
      );
    }

    await audit(tx, {
      eventType: "custom-front.deleted",
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
  await assertSystemOwnership(db, systemId, auth);

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
  await assertSystemOwnership(db, systemId, auth);

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

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived custom front not found");
    }

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
