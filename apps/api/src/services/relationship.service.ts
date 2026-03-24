import { members, relationships } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateRelationshipBodySchema,
  UpdateRelationshipBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
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
  EncryptedBlob,
  PaginatedResult,
  RelationshipId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface RelationshipResult {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: string | null;
  readonly targetMemberId: string | null;
  readonly type: string;
  readonly bidirectional: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toRelationshipResult(row: {
  id: string;
  systemId: string;
  sourceMemberId: string | null;
  targetMemberId: string | null;
  type: string;
  bidirectional: boolean;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): RelationshipResult {
  return {
    id: row.id as RelationshipId,
    systemId: row.systemId as SystemId,
    sourceMemberId: row.sourceMemberId,
    targetMemberId: row.targetMemberId,
    type: row.type,
    bidirectional: row.bidirectional,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateRelationshipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  // Reject nulls at API level (schema requires them, but be explicit)
  if (!parsed.sourceMemberId || !parsed.targetMemberId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "sourceMemberId and targetMemberId are required",
    );
  }

  const relationshipId = createId(ID_PREFIXES.relationship);
  const timestamp = now();

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    // Validate both members exist in the same system
    const memberRows = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.systemId, systemId),
          or(eq(members.id, parsed.sourceMemberId), eq(members.id, parsed.targetMemberId)),
        ),
      );

    const foundIds = new Set(memberRows.map((m) => m.id));
    if (!foundIds.has(parsed.sourceMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source member not found in this system");
    }
    if (!foundIds.has(parsed.targetMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target member not found in this system");
    }

    const [row] = await tx
      .insert(relationships)
      .values({
        id: relationshipId,
        systemId,
        sourceMemberId: parsed.sourceMemberId,
        targetMemberId: parsed.targetMemberId,
        type: parsed.type,
        bidirectional: parsed.bidirectional,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create relationship — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "relationship.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship created",
      systemId,
    });

    return toRelationshipResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listRelationships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  memberId?: string,
): Promise<PaginatedResult<RelationshipResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const conditions = [eq(relationships.systemId, systemId), eq(relationships.archived, false)];

    if (cursor) {
      conditions.push(gt(relationships.id, cursor));
    }

    if (memberId) {
      const memberFilter = or(
        eq(relationships.sourceMemberId, memberId),
        eq(relationships.targetMemberId, memberId),
      );
      if (memberFilter) {
        conditions.push(memberFilter);
      }
    }

    const rows = await tx
      .select()
      .from(relationships)
      .where(and(...conditions))
      .orderBy(relationships.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toRelationshipResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [row] = await tx
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Relationship not found");
    }

    return toRelationshipResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateRelationshipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const updated = await tx
      .update(relationships)
      .set({
        type: parsed.type,
        bidirectional: parsed.bidirectional,
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${relationships.version} + 1`,
      })
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.version, parsed.version),
          eq(relationships.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: relationships.id })
          .from(relationships)
          .where(
            and(
              eq(relationships.id, relationshipId),
              eq(relationships.systemId, systemId),
              eq(relationships.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Relationship",
    );

    await audit(tx, {
      eventType: "relationship.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship updated",
      systemId,
    });

    return toRelationshipResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    // Verify relationship exists
    const [existing] = await tx
      .select({ id: relationships.id })
      .from(relationships)
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Relationship not found");
    }

    // Audit before delete (FK satisfied since relationship still exists)
    await audit(tx, {
      eventType: "relationship.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship deleted",
      systemId,
    });

    // Hard delete
    await tx
      .delete(relationships)
      .where(and(eq(relationships.id, relationshipId), eq(relationships.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const RELATIONSHIP_LIFECYCLE = {
  table: relationships,
  columns: relationships,
  entityName: "Relationship",
  archiveEvent: "relationship.archived" as const,
  restoreEvent: "relationship.restored" as const,
};

export async function archiveRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, relationshipId, auth, audit, RELATIONSHIP_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  return restoreEntity(db, systemId, relationshipId, auth, audit, RELATIONSHIP_LIFECYCLE, (row) =>
    toRelationshipResult(row as typeof relationships.$inferSelect),
  );
}
