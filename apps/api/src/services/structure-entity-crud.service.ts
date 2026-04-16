import {
  notes,
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  CreateStructureEntityBodySchema,
  UpdateStructureEntityBodySchema,
} from "@pluralscape/validation";
import { and, count, eq, gt, or, sql } from "drizzle-orm";

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
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface StructureEntityResult {
  readonly id: SystemStructureEntityId;
  readonly systemId: SystemId;
  readonly entityTypeId: SystemStructureEntityTypeId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Row mapper ────────────────────────────────────────────────────

function toStructureEntityResult(row: {
  id: string;
  systemId: string;
  entityTypeId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): StructureEntityResult {
  return {
    id: brandId<SystemStructureEntityId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    entityTypeId: brandId<SystemStructureEntityTypeId>(row.entityTypeId),
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── Entity lifecycle config ────────────────────────────────────────

const ENTITY_LIFECYCLE = {
  table: systemStructureEntities,
  columns: systemStructureEntities,
  entityName: "Structure entity",
  archiveEvent: "structure-entity.archived" as const,
  restoreEvent: "structure-entity.restored" as const,
};

// ════════════════════════════════════════════════════════════════════
// Structure Entities
// ════════════════════════════════════════════════════════════════════

export async function createStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const entityId = createId(ID_PREFIXES.structureEntity);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify entity type exists
    const [entityType] = await tx
      .select({ id: systemStructureEntityTypes.id })
      .from(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, parsed.data.structureEntityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .limit(1);

    if (!entityType) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity type not found");
    }

    const [row] = await tx
      .insert(systemStructureEntities)
      .values({
        id: entityId,
        systemId,
        entityTypeId: parsed.data.structureEntityTypeId,
        sortOrder: parsed.data.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create structure entity — INSERT returned no rows");
    }

    // Auto-create an entity link if parentEntityId is provided
    if (parsed.data.parentEntityId !== null) {
      const linkId = createId(ID_PREFIXES.structureEntityLink);
      await tx.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId,
        parentEntityId: parsed.data.parentEntityId,
        sortOrder: 0,
        createdAt: timestamp,
      });
    }

    await audit(tx, {
      eventType: "structure-entity.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity created",
      systemId,
    });

    return toStructureEntityResult(row);
  });
}

export async function listStructureEntities(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
    entityTypeId?: SystemStructureEntityTypeId;
  },
): Promise<PaginatedResult<StructureEntityResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntities.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(systemStructureEntities.archived, false));
    }

    if (opts?.entityTypeId) {
      conditions.push(eq(systemStructureEntities.entityTypeId, opts.entityTypeId));
    }

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntities.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntities)
      .where(and(...conditions))
      .orderBy(systemStructureEntities.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toStructureEntityResult);
  });
}

export async function getStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    return toStructureEntityResult(row);
  });
}

export async function updateStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateStructureEntityBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemStructureEntities)
      .set({
        encryptedData: blob,
        sortOrder: parsed.data.sortOrder,
        updatedAt: timestamp,
        version: sql`${systemStructureEntities.version} + 1`,
      })
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.version, parsed.data.version),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: systemStructureEntities.id })
          .from(systemStructureEntities)
          .where(
            and(
              eq(systemStructureEntities.id, entityId),
              eq(systemStructureEntities.systemId, systemId),
              eq(systemStructureEntities.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Structure entity",
    );

    await audit(tx, {
      eventType: "structure-entity.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity updated",
      systemId,
    });

    return toStructureEntityResult(row);
  });
}

export async function archiveStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityId, auth, audit, ENTITY_LIFECYCLE);
}

export async function restoreStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  return restoreEntity(db, systemId, entityId, auth, audit, ENTITY_LIFECYCLE, (row) =>
    toStructureEntityResult(row as typeof systemStructureEntities.$inferSelect),
  );
}

export async function deleteStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntities.id })
      .from(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    // Check for dependents across all junction tables and notes
    const [[linkCount], [memberLinkCount], [assocCount], [noteCount]] = await Promise.all([
      tx
        .select({ count: count() })
        .from(systemStructureEntityLinks)
        .where(
          and(
            eq(systemStructureEntityLinks.systemId, systemId),
            or(
              eq(systemStructureEntityLinks.entityId, entityId),
              eq(systemStructureEntityLinks.parentEntityId, entityId),
            ),
          ),
        ),
      tx
        .select({ count: count() })
        .from(systemStructureEntityMemberLinks)
        .where(
          and(
            eq(systemStructureEntityMemberLinks.systemId, systemId),
            eq(systemStructureEntityMemberLinks.parentEntityId, entityId),
          ),
        ),
      tx
        .select({ count: count() })
        .from(systemStructureEntityAssociations)
        .where(
          and(
            eq(systemStructureEntityAssociations.systemId, systemId),
            or(
              eq(systemStructureEntityAssociations.sourceEntityId, entityId),
              eq(systemStructureEntityAssociations.targetEntityId, entityId),
            ),
          ),
        ),
      tx
        .select({ count: count() })
        .from(notes)
        .where(
          and(
            eq(notes.systemId, systemId),
            eq(notes.authorEntityType, "structure-entity"),
            eq(notes.authorEntityId, entityId),
          ),
        ),
    ]);

    if (!linkCount || !memberLinkCount || !assocCount || !noteCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    type EntityDependentType = "entityLinks" | "entityMemberLinks" | "entityAssociations" | "notes";
    const dependents: { type: EntityDependentType; count: number }[] = [];
    if (linkCount.count > 0) dependents.push({ type: "entityLinks", count: linkCount.count });
    if (memberLinkCount.count > 0)
      dependents.push({ type: "entityMemberLinks", count: memberLinkCount.count });
    if (assocCount.count > 0)
      dependents.push({ type: "entityAssociations", count: assocCount.count });
    if (noteCount.count > 0) dependents.push({ type: "notes", count: noteCount.count });

    if (dependents.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Structure entity has dependents. Remove all dependents before deleting.",
        { dependents },
      );
    }

    await audit(tx, {
      eventType: "structure-entity.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntities)
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
        ),
      );
  });
}
