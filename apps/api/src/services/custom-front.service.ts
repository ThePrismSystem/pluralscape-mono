import { customFronts, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreateCustomFrontBodySchema, UpdateCustomFrontBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantTransaction } from "../lib/rls-context.js";
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
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
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
  assertSystemOwnership(systemId, auth);

  const { blob } = parseAndValidateBlob(
    params,
    CreateCustomFrontBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const cfId = createId(ID_PREFIXES.customFront);
  const timestamp = now();

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<CustomFrontResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const conditions = [eq(customFronts.systemId, systemId), eq(customFronts.archived, false)];

    if (cursor) {
      conditions.push(gt(customFronts.id, cursor));
    }

    const rows = await tx
      .select()
      .from(customFronts)
      .where(and(...conditions))
      .orderBy(customFronts.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toCustomFrontResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
): Promise<CustomFrontResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [row] = await tx
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
  });
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
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateCustomFrontBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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

const CUSTOM_FRONT_LIFECYCLE = {
  table: customFronts,
  columns: customFronts,
  entityName: "Custom front",
  archiveEvent: "custom-front.archived" as const,
  restoreEvent: "custom-front.restored" as const,
};

export async function archiveCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, customFrontId, auth, audit, CUSTOM_FRONT_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  return restoreEntity(db, systemId, customFrontId, auth, audit, CUSTOM_FRONT_LIFECYCLE, (row) =>
    toCustomFrontResult(row as typeof customFronts.$inferSelect),
  );
}
