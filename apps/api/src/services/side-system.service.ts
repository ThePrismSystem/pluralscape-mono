import {
  sideSystemLayerLinks,
  sideSystemMemberships,
  sideSystems,
  subsystemSideSystemLinks,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { CreateSideSystemBodySchema, UpdateSideSystemBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/assert-system-ownership.js";
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
  PaginatedResult,
  PaginationCursor,
  SideSystemId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SideSystemResult {
  readonly id: SideSystemId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toSideSystemResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): SideSystemResult {
  return {
    id: row.id as SideSystemId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SideSystemResult> {
  assertSystemOwnership(auth, systemId);

  const { blob } = parseAndValidateBlob(
    params,
    CreateSideSystemBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const sideSystemId = createId(ID_PREFIXES.sideSystem);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sideSystems)
      .values({
        id: sideSystemId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create side system — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "side-system.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Side system created",
      systemId,
    });

    return toSideSystemResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listSideSystems(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<SideSystemResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [eq(sideSystems.systemId, systemId), eq(sideSystems.archived, false)];

  if (cursor) {
    conditions.push(gt(sideSystems.id, cursor));
  }

  const rows = await db
    .select()
    .from(sideSystems)
    .where(and(...conditions))
    .orderBy(sideSystems.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toSideSystemResult);
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

export async function getSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: SideSystemId,
  auth: AuthContext,
): Promise<SideSystemResult> {
  assertSystemOwnership(auth, systemId);

  const [row] = await db
    .select()
    .from(sideSystems)
    .where(
      and(
        eq(sideSystems.id, sideSystemId),
        eq(sideSystems.systemId, systemId),
        eq(sideSystems.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Side system not found");
  }

  return toSideSystemResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: SideSystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SideSystemResult> {
  assertSystemOwnership(auth, systemId);

  const { blob, parsed } = parseAndValidateBlob(
    params,
    UpdateSideSystemBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(sideSystems)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${sideSystems.version} + 1`,
      })
      .where(
        and(
          eq(sideSystems.id, sideSystemId),
          eq(sideSystems.systemId, systemId),
          eq(sideSystems.version, parsed.version),
          eq(sideSystems.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: sideSystems.id })
          .from(sideSystems)
          .where(
            and(
              eq(sideSystems.id, sideSystemId),
              eq(sideSystems.systemId, systemId),
              eq(sideSystems.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Side system",
    );

    await audit(tx, {
      eventType: "side-system.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Side system updated",
      systemId,
    });

    return toSideSystemResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: SideSystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sideSystems.id })
      .from(sideSystems)
      .where(
        and(
          eq(sideSystems.id, sideSystemId),
          eq(sideSystems.systemId, systemId),
          eq(sideSystems.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Side system not found");
    }

    // Check for memberships
    const [membershipCount] = await tx
      .select({ count: count() })
      .from(sideSystemMemberships)
      .where(eq(sideSystemMemberships.sideSystemId, sideSystemId));

    // Check for subsystem-side-system links
    const [subsystemLinkCount] = await tx
      .select({ count: count() })
      .from(subsystemSideSystemLinks)
      .where(eq(subsystemSideSystemLinks.sideSystemId, sideSystemId));

    // Check for side-system-layer links
    const [layerLinkCount] = await tx
      .select({ count: count() })
      .from(sideSystemLayerLinks)
      .where(eq(sideSystemLayerLinks.sideSystemId, sideSystemId));

    if (!membershipCount || !subsystemLinkCount || !layerLinkCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    const totalDependents = membershipCount.count + subsystemLinkCount.count + layerLinkCount.count;

    if (totalDependents > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Side system has dependents. Remove all memberships and links before deleting.`,
      );
    }

    await audit(tx, {
      eventType: "side-system.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Side system deleted",
      systemId,
    });

    await tx
      .delete(sideSystems)
      .where(and(eq(sideSystems.id, sideSystemId), eq(sideSystems.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: SideSystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sideSystems.id })
      .from(sideSystems)
      .where(
        and(
          eq(sideSystems.id, sideSystemId),
          eq(sideSystems.systemId, systemId),
          eq(sideSystems.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Side system not found");
    }

    await tx
      .update(sideSystems)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(sideSystems.id, sideSystemId), eq(sideSystems.systemId, systemId)));

    await audit(tx, {
      eventType: "side-system.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Side system archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreSideSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: SideSystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SideSystemResult> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sideSystems.id })
      .from(sideSystems)
      .where(
        and(
          eq(sideSystems.id, sideSystemId),
          eq(sideSystems.systemId, systemId),
          eq(sideSystems.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived side system not found");
    }

    const updated = await tx
      .update(sideSystems)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${sideSystems.version} + 1`,
      })
      .where(and(eq(sideSystems.id, sideSystemId), eq(sideSystems.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived side system not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "side-system.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Side system restored",
      systemId,
    });

    return toSideSystemResult(row);
  });
}
