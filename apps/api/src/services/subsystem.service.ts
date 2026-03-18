import {
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { CreateSubsystemBodySchema, UpdateSubsystemBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
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
  SubsystemId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Safety cap for ancestor walk during cycle detection.
 * Limits subsystem nesting to 50 levels — sufficient for any practical
 * system structure while preventing runaway traversals from circular references.
 */
const MAX_ANCESTOR_DEPTH = 50;

// ── Types ───────────────────────────────────────────────────────────

export interface SubsystemResult {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly parentSubsystemId: SubsystemId | null;
  readonly architectureType: unknown;
  readonly hasCore: boolean;
  readonly discoveryStatus: string | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toSubsystemResult(row: {
  id: string;
  systemId: string;
  parentSubsystemId: string | null;
  architectureType: unknown;
  hasCore: boolean;
  discoveryStatus: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): SubsystemResult {
  return {
    id: row.id as SubsystemId,
    systemId: row.systemId as SystemId,
    parentSubsystemId: row.parentSubsystemId as SubsystemId | null,
    architectureType: row.architectureType,
    hasCore: row.hasCore,
    discoveryStatus: row.discoveryStatus,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SubsystemResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateSubsystemBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const subsystemId = createId(ID_PREFIXES.subsystem);
  const timestamp = now();

  return db.transaction(async (tx) => {
    if (parsed.parentSubsystemId !== null) {
      const [parent] = await tx
        .select({ id: subsystems.id })
        .from(subsystems)
        .where(
          and(
            eq(subsystems.id, parsed.parentSubsystemId),
            eq(subsystems.systemId, systemId),
            eq(subsystems.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent subsystem not found");
      }
    }

    const [row] = await tx
      .insert(subsystems)
      .values({
        id: subsystemId,
        systemId,
        parentSubsystemId: parsed.parentSubsystemId,
        architectureType: parsed.architectureType,
        hasCore: parsed.hasCore,
        discoveryStatus: parsed.discoveryStatus,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create subsystem — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "subsystem.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Subsystem created",
      systemId,
    });

    return toSubsystemResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listSubsystems(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<SubsystemResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [eq(subsystems.systemId, systemId), eq(subsystems.archived, false)];

  if (cursor) {
    conditions.push(gt(subsystems.id, cursor));
  }

  const rows = await db
    .select()
    .from(subsystems)
    .where(and(...conditions))
    .orderBy(subsystems.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toSubsystemResult);
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

export async function getSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: SubsystemId,
  auth: AuthContext,
): Promise<SubsystemResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(subsystems)
    .where(
      and(
        eq(subsystems.id, subsystemId),
        eq(subsystems.systemId, systemId),
        eq(subsystems.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Subsystem not found");
  }

  return toSubsystemResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: SubsystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SubsystemResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateSubsystemBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return db.transaction(async (tx) => {
    // Reject self-parenting
    if (parsed.parentSubsystemId === subsystemId) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Cannot set subsystem as its own parent",
      );
    }

    // If parentSubsystemId is non-null, validate and check for cycles
    if (parsed.parentSubsystemId !== null) {
      let currentId: string | null = parsed.parentSubsystemId;
      for (let i = 0; i < MAX_ANCESTOR_DEPTH && currentId !== null; i++) {
        if (currentId === subsystemId) {
          throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Circular reference detected");
        }
        const [ancestor] = await tx
          .select({ parentSubsystemId: subsystems.parentSubsystemId })
          .from(subsystems)
          .where(and(eq(subsystems.id, currentId), eq(subsystems.systemId, systemId)))
          .limit(1);
        if (!ancestor) {
          throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent subsystem not found");
        }
        currentId = ancestor.parentSubsystemId;
      }

      if (currentId !== null) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "CONFLICT",
          "Subsystem hierarchy too deep or contains a cycle",
        );
      }
    }

    const updated = await tx
      .update(subsystems)
      .set({
        parentSubsystemId: parsed.parentSubsystemId,
        architectureType: parsed.architectureType,
        hasCore: parsed.hasCore,
        discoveryStatus: parsed.discoveryStatus,
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${subsystems.version} + 1`,
      })
      .where(
        and(
          eq(subsystems.id, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.version, parsed.version),
          eq(subsystems.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: subsystems.id })
          .from(subsystems)
          .where(
            and(
              eq(subsystems.id, subsystemId),
              eq(subsystems.systemId, systemId),
              eq(subsystems.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Subsystem",
    );

    await audit(tx, {
      eventType: "subsystem.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Subsystem updated",
      systemId,
    });

    return toSubsystemResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: SubsystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subsystems.id })
      .from(subsystems)
      .where(
        and(
          eq(subsystems.id, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Subsystem not found");
    }

    // Check for child subsystems
    const [childCount] = await tx
      .select({ count: count() })
      .from(subsystems)
      .where(
        and(
          eq(subsystems.parentSubsystemId, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.archived, false),
        ),
      );

    // Check for memberships
    const [membershipCount] = await tx
      .select({ count: count() })
      .from(subsystemMemberships)
      .where(
        and(
          eq(subsystemMemberships.subsystemId, subsystemId),
          eq(subsystemMemberships.systemId, systemId),
        ),
      );

    // Check for cross-structure links (subsystem-layer + subsystem-side-system)
    const [layerLinkCount] = await tx
      .select({ count: count() })
      .from(subsystemLayerLinks)
      .where(
        and(
          eq(subsystemLayerLinks.subsystemId, subsystemId),
          eq(subsystemLayerLinks.systemId, systemId),
        ),
      );

    const [sideSystemLinkCount] = await tx
      .select({ count: count() })
      .from(subsystemSideSystemLinks)
      .where(
        and(
          eq(subsystemSideSystemLinks.subsystemId, subsystemId),
          eq(subsystemSideSystemLinks.systemId, systemId),
        ),
      );

    if (!childCount || !membershipCount || !layerLinkCount || !sideSystemLinkCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    const totalDependents =
      childCount.count + membershipCount.count + layerLinkCount.count + sideSystemLinkCount.count;

    if (totalDependents > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Subsystem has dependents. Remove all child subsystems, memberships, and links before deleting.`,
      );
    }

    await audit(tx, {
      eventType: "subsystem.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Subsystem deleted",
      systemId,
    });

    await tx
      .delete(subsystems)
      .where(and(eq(subsystems.id, subsystemId), eq(subsystems.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: SubsystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subsystems.id })
      .from(subsystems)
      .where(
        and(
          eq(subsystems.id, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Subsystem not found");
    }

    await tx
      .update(subsystems)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(subsystems.id, subsystemId), eq(subsystems.systemId, systemId)));

    await audit(tx, {
      eventType: "subsystem.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Subsystem archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreSubsystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: SubsystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SubsystemResult> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subsystems.id, parentSubsystemId: subsystems.parentSubsystemId })
      .from(subsystems)
      .where(
        and(
          eq(subsystems.id, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived subsystem not found");
    }

    // If parent is archived, promote to root
    let newParentSubsystemId = existing.parentSubsystemId;
    if (newParentSubsystemId !== null) {
      const [parent] = await tx
        .select({ archived: subsystems.archived })
        .from(subsystems)
        .where(and(eq(subsystems.id, newParentSubsystemId), eq(subsystems.systemId, systemId)))
        .limit(1);

      if (!parent || parent.archived) {
        newParentSubsystemId = null;
      }
    }

    const updated = await tx
      .update(subsystems)
      .set({
        archived: false,
        archivedAt: null,
        parentSubsystemId: newParentSubsystemId,
        updatedAt: timestamp,
        version: sql`${subsystems.version} + 1`,
      })
      .where(and(eq(subsystems.id, subsystemId), eq(subsystems.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived subsystem not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "subsystem.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Subsystem restored",
      systemId,
    });

    return toSubsystemResult(row);
  });
}
