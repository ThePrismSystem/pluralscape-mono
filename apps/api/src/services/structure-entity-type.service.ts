import { systemStructureEntities, systemStructureEntityTypes } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateStructureEntityTypeBodySchema,
  UpdateStructureEntityTypeBodySchema,
} from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_ENCRYPTED_DATA_BYTES } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  PaginatedResult,
  SystemId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityTypeResult {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Row mapper ────────────────────────────────────────────────────

function toEntityTypeResult(row: {
  id: string;
  systemId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): EntityTypeResult {
  return {
    id: row.id as SystemStructureEntityTypeId,
    systemId: row.systemId as SystemId,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── Entity Type lifecycle config ───────────────────────────────────

const ENTITY_TYPE_LIFECYCLE = {
  table: systemStructureEntityTypes,
  columns: systemStructureEntityTypes,
  entityName: "Structure entity type",
  archiveEvent: "structure-entity-type.archived" as const,
  restoreEvent: "structure-entity-type.restored" as const,
};

// ════════════════════════════════════════════════════════════════════
// Entity Types
// ════════════════════════════════════════════════════════════════════

export async function createEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityTypeBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const entityTypeId = createId(ID_PREFIXES.structureEntityType);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityTypes)
      .values({
        id: entityTypeId,
        systemId,
        sortOrder: parsed.data.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity type — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-type.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type created",
      systemId,
    });

    return toEntityTypeResult(row);
  });
}

export async function listEntityTypes(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<EntityTypeResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityTypes.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(systemStructureEntityTypes.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityTypes.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityTypes)
      .where(and(...conditions))
      .orderBy(systemStructureEntityTypes.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityTypeResult);
  });
}

export async function getEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity type not found");
    }

    return toEntityTypeResult(row);
  });
}

export async function updateEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateStructureEntityTypeBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemStructureEntityTypes)
      .set({
        encryptedData: blob,
        sortOrder: parsed.data.sortOrder,
        updatedAt: timestamp,
        version: sql`${systemStructureEntityTypes.version} + 1`,
      })
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.version, parsed.data.version),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: systemStructureEntityTypes.id })
          .from(systemStructureEntityTypes)
          .where(
            and(
              eq(systemStructureEntityTypes.id, entityTypeId),
              eq(systemStructureEntityTypes.systemId, systemId),
              eq(systemStructureEntityTypes.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Structure entity type",
    );

    await audit(tx, {
      eventType: "structure-entity-type.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type updated",
      systemId,
    });

    return toEntityTypeResult(row);
  });
}

export async function archiveEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityTypeId, auth, audit, ENTITY_TYPE_LIFECYCLE);
}

export async function restoreEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  return restoreEntity(db, systemId, entityTypeId, auth, audit, ENTITY_TYPE_LIFECYCLE, (row) =>
    toEntityTypeResult(row as typeof systemStructureEntityTypes.$inferSelect),
  );
}

export async function deleteEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityTypes.id })
      .from(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity type not found");
    }

    // Check for entities referencing this type
    const [entityCount] = await tx
      .select({ count: count() })
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.entityTypeId, entityTypeId),
          eq(systemStructureEntities.systemId, systemId),
        ),
      );

    if (!entityCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (entityCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Structure entity type has ${String(entityCount.count)} entity(s). Remove all entities before deleting.`,
        { dependents: [{ type: "structureEntities", count: entityCount.count }] },
      );
    }

    await audit(tx, {
      eventType: "structure-entity-type.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
        ),
      );
  });
}
