import {
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateStructureEntityBodySchema,
  CreateStructureEntityTypeBodySchema,
  UpdateStructureEntityBodySchema,
  UpdateStructureEntityTypeBodySchema,
} from "@pluralscape/validation";
import {
  CreateStructureEntityAssociationBodySchema,
  CreateStructureEntityLinkBodySchema,
  CreateStructureEntityMemberLinkBodySchema,
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
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ANCESTOR_DEPTH,
  MAX_ENCRYPTED_DATA_BYTES,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityTypeResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly entityTypeId: string;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface EntityLinkResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly entityId: string;
  readonly parentEntityId: string | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

export interface EntityMemberLinkResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly parentEntityId: string | null;
  readonly memberId: string;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

export interface EntityAssociationResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly createdAt: UnixMillis;
}

export interface HierarchyNode {
  readonly entityId: string;
  readonly parentEntityId: string | null;
  readonly depth: number;
}

// ── Row mappers ────────────────────────────────────────────────────

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
    id: row.id,
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
    id: row.id,
    systemId: row.systemId as SystemId,
    entityTypeId: row.entityTypeId,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

function toEntityLinkResult(row: {
  id: string;
  systemId: string;
  entityId: string;
  parentEntityId: string | null;
  sortOrder: number;
  createdAt: number;
}): EntityLinkResult {
  return {
    id: row.id,
    systemId: row.systemId as SystemId,
    entityId: row.entityId,
    parentEntityId: row.parentEntityId,
    sortOrder: row.sortOrder,
    createdAt: toUnixMillis(row.createdAt),
  };
}

function toEntityMemberLinkResult(row: {
  id: string;
  systemId: string;
  parentEntityId: string | null;
  memberId: string;
  sortOrder: number;
  createdAt: number;
}): EntityMemberLinkResult {
  return {
    id: row.id,
    systemId: row.systemId as SystemId,
    parentEntityId: row.parentEntityId,
    memberId: row.memberId,
    sortOrder: row.sortOrder,
    createdAt: toUnixMillis(row.createdAt),
  };
}

function toEntityAssociationResult(row: {
  id: string;
  systemId: string;
  sourceEntityId: string;
  targetEntityId: string;
  createdAt: number;
}): EntityAssociationResult {
  return {
    id: row.id,
    systemId: row.systemId as SystemId,
    sourceEntityId: row.sourceEntityId,
    targetEntityId: row.targetEntityId,
    createdAt: toUnixMillis(row.createdAt),
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

// ── Entity lifecycle config ────────────────────────────────────────

const ENTITY_LIFECYCLE = {
  table: systemStructureEntities,
  columns: systemStructureEntities,
  entityName: "Structure entity",
  archiveEvent: "structure-entity.archived" as const,
  restoreEvent: "structure-entity.restored" as const,
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
  entityTypeId: string,
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
  entityTypeId: string,
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
  entityTypeId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityTypeId, auth, audit, ENTITY_TYPE_LIFECYCLE);
}

export async function restoreEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: string,
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
  entityTypeId: string,
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
      .limit(1);

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
    entityTypeId?: string;
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
  entityId: string,
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
  entityId: string,
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
  entityId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityId, auth, audit, ENTITY_LIFECYCLE);
}

export async function restoreStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
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
  entityId: string,
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
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    // Check for dependents across all junction tables
    const [[linkCount], [memberLinkCount], [assocCount]] = await Promise.all([
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
    ]);

    if (!linkCount || !memberLinkCount || !assocCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    type EntityDependentType = "entityLinks" | "entityMemberLinks" | "entityAssociations";
    const dependents: { type: EntityDependentType; count: number }[] = [];
    if (linkCount.count > 0) dependents.push({ type: "entityLinks", count: linkCount.count });
    if (memberLinkCount.count > 0)
      dependents.push({ type: "entityMemberLinks", count: memberLinkCount.count });
    if (assocCount.count > 0)
      dependents.push({ type: "entityAssociations", count: assocCount.count });

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

// ════════════════════════════════════════════════════════════════════
// Entity Links (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const linkId = createId(ID_PREFIXES.structureEntityLink);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityLinks)
      .values({
        id: linkId,
        systemId,
        entityId: parsed.data.entityId,
        parentEntityId: parsed.data.parentEntityId,
        sortOrder: parsed.data.sortOrder,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity link — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-link.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link created",
      systemId,
    });

    return toEntityLinkResult(row);
  });
}

export async function listEntityLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityLinkResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityLinks.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityLinks.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityLinks)
      .where(and(...conditions))
      .orderBy(systemStructureEntityLinks.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityLinkResult);
  });
}

export async function deleteEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityLinks.id })
      .from(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkId),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity link not found");
    }

    await audit(tx, {
      eventType: "structure-entity-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkId),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      );
  });
}

// ════════════════════════════════════════════════════════════════════
// Entity Member Links (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityMemberLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityMemberLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityMemberLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const linkId = createId(ID_PREFIXES.structureEntityMemberLink);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityMemberLinks)
      .values({
        id: linkId,
        systemId,
        parentEntityId: parsed.data.parentEntityId,
        memberId: parsed.data.memberId,
        sortOrder: parsed.data.sortOrder,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity member link — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-member-link.added",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity member link added",
      systemId,
    });

    return toEntityMemberLinkResult(row);
  });
}

export async function listEntityMemberLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityMemberLinkResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityMemberLinks.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityMemberLinks.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityMemberLinks)
      .where(and(...conditions))
      .orderBy(systemStructureEntityMemberLinks.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityMemberLinkResult);
  });
}

export async function deleteEntityMemberLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityMemberLinks.id })
      .from(systemStructureEntityMemberLinks)
      .where(
        and(
          eq(systemStructureEntityMemberLinks.id, linkId),
          eq(systemStructureEntityMemberLinks.systemId, systemId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity member link not found");
    }

    await audit(tx, {
      eventType: "structure-entity-member-link.removed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity member link removed",
      systemId,
    });

    await tx
      .delete(systemStructureEntityMemberLinks)
      .where(
        and(
          eq(systemStructureEntityMemberLinks.id, linkId),
          eq(systemStructureEntityMemberLinks.systemId, systemId),
        ),
      );
  });
}

// ════════════════════════════════════════════════════════════════════
// Entity Associations (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityAssociation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityAssociationResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityAssociationBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const assocId = createId(ID_PREFIXES.structureEntityAssociation);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityAssociations)
      .values({
        id: assocId,
        systemId,
        sourceEntityId: parsed.data.sourceEntityId,
        targetEntityId: parsed.data.targetEntityId,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity association — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-association.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity association created",
      systemId,
    });

    return toEntityAssociationResult(row);
  });
}

export async function listEntityAssociations(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityAssociationResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityAssociations.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityAssociations.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityAssociations)
      .where(and(...conditions))
      .orderBy(systemStructureEntityAssociations.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityAssociationResult);
  });
}

export async function deleteEntityAssociation(
  db: PostgresJsDatabase,
  systemId: SystemId,
  assocId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityAssociations.id })
      .from(systemStructureEntityAssociations)
      .where(
        and(
          eq(systemStructureEntityAssociations.id, assocId),
          eq(systemStructureEntityAssociations.systemId, systemId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity association not found");
    }

    await audit(tx, {
      eventType: "structure-entity-association.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity association deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityAssociations)
      .where(
        and(
          eq(systemStructureEntityAssociations.id, assocId),
          eq(systemStructureEntityAssociations.systemId, systemId),
        ),
      );
  });
}

// ════════════════════════════════════════════════════════════════════
// Hierarchy
// ════════════════════════════════════════════════════════════════════

/**
 * Walk the entity link hierarchy using a recursive CTE, capped at
 * MAX_ANCESTOR_DEPTH to prevent runaway queries and detect cycles.
 */
export async function getEntityHierarchy(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
): Promise<readonly HierarchyNode[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify entity exists
    const [entity] = await tx
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

    if (!entity) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
    }

    const rows = await tx.execute<{
      entity_id: string;
      parent_entity_id: string | null;
      depth: number;
    }>(sql`
      WITH RECURSIVE hierarchy AS (
        SELECT
          ${systemStructureEntityLinks.entityId} AS entity_id,
          ${systemStructureEntityLinks.parentEntityId} AS parent_entity_id,
          1 AS depth
        FROM ${systemStructureEntityLinks}
        WHERE ${systemStructureEntityLinks.entityId} = ${entityId}
          AND ${systemStructureEntityLinks.systemId} = ${systemId}

        UNION ALL

        SELECT
          l.${sql.raw("entity_id")} AS entity_id,
          l.${sql.raw("parent_entity_id")} AS parent_entity_id,
          h.depth + 1 AS depth
        FROM ${systemStructureEntityLinks} l
        INNER JOIN hierarchy h ON l.${sql.raw("entity_id")} = h.parent_entity_id
        WHERE l.${sql.raw("system_id")} = ${systemId}
          AND h.depth < ${MAX_ANCESTOR_DEPTH}
      )
      SELECT entity_id, parent_entity_id, depth FROM hierarchy
      ORDER BY depth ASC
    `);

    return rows.map((r) => ({
      entityId: r.entity_id,
      parentEntityId: r.parent_entity_id,
      depth: r.depth,
    }));
  });
}
