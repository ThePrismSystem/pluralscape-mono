import { innerworldEntities, innerworldRegions, systems } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { CreateEntityBodySchema, UpdateEntityBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity as archiveEntityGeneric } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_INNERWORLD_ENTITIES_PER_SYSTEM } from "../quota.constants.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  InnerWorldEntityId,
  InnerWorldRegionId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface EntityResult {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly regionId: InnerWorldRegionId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toEntityResult(row: {
  id: string;
  systemId: string;
  regionId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): EntityResult {
  return {
    id: brandId<InnerWorldEntityId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    regionId: row.regionId ? brandId<InnerWorldRegionId>(row.regionId) : null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateEntityBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const entityId = createId(ID_PREFIXES.innerWorldEntity);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system entity quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(innerworldEntities)
      .where(
        and(eq(innerworldEntities.systemId, systemId), eq(innerworldEntities.archived, false)),
      );

    if ((existingCount?.count ?? 0) >= MAX_INNERWORLD_ENTITIES_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_INNERWORLD_ENTITIES_PER_SYSTEM)} innerworld entities per system`,
      );
    }

    // Validate regionId exists in same system if provided
    const regionId = parsed.regionId ?? null;
    if (regionId !== null) {
      const [region] = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, regionId),
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        )
        .limit(1);

      if (!region) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
      }
    }

    const [row] = await tx
      .insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        regionId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "innerworld-entity.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity created",
      systemId,
    });

    return toEntityResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listEntities(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    regionId?: InnerWorldRegionId;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<EntityResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(innerworldEntities.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(innerworldEntities.archived, false));
    }

    if (opts?.regionId) {
      conditions.push(eq(innerworldEntities.regionId, opts.regionId));
    }

    if (opts?.cursor) {
      conditions.push(gt(innerworldEntities.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(innerworldEntities)
      .where(and(...conditions))
      .orderBy(innerworldEntities.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toEntityResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Entity not found");
    }

    return toEntityResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateEntityBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(innerworldEntities)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${innerworldEntities.version} + 1`,
      })
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.version, parsed.version),
          eq(innerworldEntities.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: innerworldEntities.id })
          .from(innerworldEntities)
          .where(
            and(
              eq(innerworldEntities.id, entityId),
              eq(innerworldEntities.systemId, systemId),
              eq(innerworldEntities.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Entity",
    );

    await audit(tx, {
      eventType: "innerworld-entity.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity updated",
      systemId,
    });

    return toEntityResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const INNERWORLD_ENTITY_LIFECYCLE = {
  table: innerworldEntities,
  columns: innerworldEntities,
  entityName: "Entity",
  archiveEvent: "innerworld-entity.archived" as const,
  restoreEvent: "innerworld-entity.restored" as const,
};

export async function archiveEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntityGeneric(db, systemId, entityId, auth, audit, INNERWORLD_ENTITY_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldEntities.id, regionId: innerworldEntities.regionId })
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived entity not found");
    }

    // If entity's region is archived, set regionId to null
    let newRegionId = existing.regionId;
    if (newRegionId !== null) {
      const [region] = await tx
        .select({ archived: innerworldRegions.archived })
        .from(innerworldRegions)
        .where(and(eq(innerworldRegions.id, newRegionId), eq(innerworldRegions.systemId, systemId)))
        .limit(1);

      if (!region || region.archived) {
        newRegionId = null;
      }
    }

    const updated = await tx
      .update(innerworldEntities)
      .set({
        archived: false,
        archivedAt: null,
        regionId: newRegionId,
        updatedAt: timestamp,
        version: sql`${innerworldEntities.version} + 1`,
      })
      .where(and(eq(innerworldEntities.id, entityId), eq(innerworldEntities.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived entity not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "innerworld-entity.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity restored",
      systemId,
    });

    return toEntityResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldEntities.id })
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Entity not found");
    }

    // Audit before delete (FK satisfied since entity still exists)
    await audit(tx, {
      eventType: "innerworld-entity.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity deleted",
      systemId,
    });

    // Hard delete — no HAS_DEPENDENTS check for entities
    await tx
      .delete(innerworldEntities)
      .where(and(eq(innerworldEntities.id, entityId), eq(innerworldEntities.systemId, systemId)));
  });
}
