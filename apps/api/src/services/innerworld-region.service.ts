import { innerworldEntities, innerworldRegions, systems } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { CreateRegionBodySchema, UpdateRegionBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, inArray, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_INNERWORLD_REGIONS_PER_SYSTEM } from "../quota.constants.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  InnerWorldRegionId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface RegionResult {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toRegionResult(row: {
  id: string;
  systemId: string;
  parentRegionId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): RegionResult {
  return {
    id: brandId<InnerWorldRegionId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    parentRegionId: row.parentRegionId ? brandId<InnerWorldRegionId>(row.parentRegionId) : null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateRegionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const regionId = createId(ID_PREFIXES.innerWorldRegion);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system region quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(innerworldRegions)
      .where(and(eq(innerworldRegions.systemId, systemId), eq(innerworldRegions.archived, false)));

    if ((existingCount?.count ?? 0) >= MAX_INNERWORLD_REGIONS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_INNERWORLD_REGIONS_PER_SYSTEM)} innerworld regions per system`,
      );
    }

    // Validate parentRegionId exists in same system if provided
    const parentRegionId = parsed.parentRegionId ?? null;
    if (parentRegionId !== null) {
      const [parent] = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, parentRegionId),
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent region not found");
      }
    }

    const [row] = await tx
      .insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        parentRegionId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create region — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "innerworld-region.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region created",
      systemId,
    });

    return toRegionResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listRegions(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<RegionResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(innerworldRegions.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(innerworldRegions.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(innerworldRegions.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(innerworldRegions)
      .where(and(...conditions))
      .orderBy(innerworldRegions.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toRegionResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    return toRegionResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateRegionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(innerworldRegions)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${innerworldRegions.version} + 1`,
      })
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.version, parsed.version),
          eq(innerworldRegions.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
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
        return existing;
      },
      "Region",
    );

    await audit(tx, {
      eventType: "innerworld-region.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region updated",
      systemId,
    });

    return toRegionResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    // Cascade archive: collect all descendant region IDs
    const regionsToArchive = [regionId];
    let frontier = [regionId];

    while (frontier.length > 0) {
      const children = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            sql`${innerworldRegions.parentRegionId} IN (${sql.join(
              frontier.map((id) => sql`${id}`),
              sql`, `,
            )})`,
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        );

      frontier = children.map((c) => brandId<InnerWorldRegionId>(c.id));
      regionsToArchive.push(...frontier);
    }

    // Batch archive all collected regions
    await tx
      .update(innerworldRegions)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          inArray(innerworldRegions.id, regionsToArchive),
          eq(innerworldRegions.systemId, systemId),
        ),
      );

    // Batch archive all entities in any of the archived regions
    await tx
      .update(innerworldEntities)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          inArray(innerworldEntities.regionId, regionsToArchive),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      );

    await audit(tx, {
      eventType: "innerworld-region.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: `Region archived (cascade: ${String(regionsToArchive.length)} region(s))`,
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: innerworldRegions.id, parentRegionId: innerworldRegions.parentRegionId })
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived region not found");
    }

    // If parent is archived, promote to root
    let newParentRegionId = existing.parentRegionId;
    if (newParentRegionId !== null) {
      const [parent] = await tx
        .select({ archived: innerworldRegions.archived })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, newParentRegionId),
            eq(innerworldRegions.systemId, systemId),
          ),
        )
        .limit(1);

      if (!parent || parent.archived) {
        newParentRegionId = null;
      }
    }

    const updated = await tx
      .update(innerworldRegions)
      .set({
        archived: false,
        archivedAt: null,
        parentRegionId: newParentRegionId,
        updatedAt: timestamp,
        version: sql`${innerworldRegions.version} + 1`,
      })
      .where(and(eq(innerworldRegions.id, regionId), eq(innerworldRegions.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived region not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "innerworld-region.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region restored",
      systemId,
    });

    return toRegionResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify region exists
    const [existing] = await tx
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
    }

    // Check for non-archived child regions
    const [childCount] = await tx
      .select({ count: count() })
      .from(innerworldRegions)
      .where(
        and(
          eq(innerworldRegions.parentRegionId, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.archived, false),
        ),
      );

    // Check for non-archived entities
    const [entityCount] = await tx
      .select({ count: count() })
      .from(innerworldEntities)
      .where(
        and(
          eq(innerworldEntities.regionId, regionId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.archived, false),
        ),
      );

    if (!childCount || !entityCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    const children = childCount.count;
    const entities = entityCount.count;

    if (children > 0 || entities > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Region has ${String(children)} child region(s) and ${String(entities)} entity/entities. Remove all dependents before deleting.`,
      );
    }

    // Audit before delete (FK satisfied since region still exists)
    await audit(tx, {
      eventType: "innerworld-region.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region deleted",
      systemId,
    });

    // Hard delete
    await tx
      .delete(innerworldRegions)
      .where(and(eq(innerworldRegions.id, regionId), eq(innerworldRegions.systemId, systemId)));
  });
}
