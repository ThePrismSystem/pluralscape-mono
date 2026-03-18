import {
  layerMemberships,
  layers,
  sideSystemLayerLinks,
  subsystemLayerLinks,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { CreateLayerBodySchema, UpdateLayerBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  LayerId,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface LayerResult {
  readonly id: LayerId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toLayerResult(row: {
  id: string;
  systemId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): LayerResult {
  return {
    id: row.id as LayerId,
    systemId: row.systemId as SystemId,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LayerResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateLayerBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const layerId = createId(ID_PREFIXES.layer);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(layers)
      .values({
        id: layerId,
        systemId,
        sortOrder: parsed.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create layer — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "layer.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Layer created",
      systemId,
    });

    return toLayerResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listLayers(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<LayerResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [eq(layers.systemId, systemId), eq(layers.archived, false)];

  if (cursor) {
    conditions.push(gt(layers.id, cursor));
  }

  const rows = await db
    .select()
    .from(layers)
    .where(and(...conditions))
    .orderBy(layers.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toLayerResult);
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

export async function getLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: LayerId,
  auth: AuthContext,
): Promise<LayerResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(layers)
    .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Layer not found");
  }

  return toLayerResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: LayerId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LayerResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateLayerBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(layers)
      .set({
        sortOrder: parsed.sortOrder,
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${layers.version} + 1`,
      })
      .where(
        and(
          eq(layers.id, layerId),
          eq(layers.systemId, systemId),
          eq(layers.version, parsed.version),
          eq(layers.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: layers.id })
          .from(layers)
          .where(
            and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Layer",
    );

    await audit(tx, {
      eventType: "layer.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Layer updated",
      systemId,
    });

    return toLayerResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: LayerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: layers.id })
      .from(layers)
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Layer not found");
    }

    // Check for layer memberships
    const [membershipCount] = await tx
      .select({ count: count() })
      .from(layerMemberships)
      .where(and(eq(layerMemberships.layerId, layerId), eq(layerMemberships.systemId, systemId)));

    // Check for subsystem-layer links
    const [subsystemLinkCount] = await tx
      .select({ count: count() })
      .from(subsystemLayerLinks)
      .where(
        and(eq(subsystemLayerLinks.layerId, layerId), eq(subsystemLayerLinks.systemId, systemId)),
      );

    // Check for side-system-layer links
    const [sideSystemLinkCount] = await tx
      .select({ count: count() })
      .from(sideSystemLayerLinks)
      .where(
        and(eq(sideSystemLayerLinks.layerId, layerId), eq(sideSystemLayerLinks.systemId, systemId)),
      );

    if (!membershipCount || !subsystemLinkCount || !sideSystemLinkCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    const totalDependents =
      membershipCount.count + subsystemLinkCount.count + sideSystemLinkCount.count;

    if (totalDependents > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Layer has dependents. Remove all memberships and links before deleting.`,
      );
    }

    // Audit before delete (FK satisfied since layer still exists)
    await audit(tx, {
      eventType: "layer.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Layer deleted",
      systemId,
    });

    // Hard delete
    await tx.delete(layers).where(and(eq(layers.id, layerId), eq(layers.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: LayerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: layers.id })
      .from(layers)
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Layer not found");
    }

    await tx
      .update(layers)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId)));

    await audit(tx, {
      eventType: "layer.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Layer archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreLayer(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: LayerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LayerResult> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: layers.id })
      .from(layers)
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, true)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived layer not found");
    }

    const updated = await tx
      .update(layers)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${layers.version} + 1`,
      })
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived layer not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "layer.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Layer restored",
      systemId,
    });

    return toLayerResult(row);
  });
}
