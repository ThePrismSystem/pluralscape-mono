import { frontingComments, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateFrontingCommentBodySchema,
  UpdateFrontingCommentBodySchema,
} from "@pluralscape/validation";
import { and, eq, lt, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
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
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface FrontingCommentResult {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toFrontingCommentResult(row: {
  id: string;
  frontingSessionId: string;
  systemId: string;
  memberId: string | null;
  customFrontId: string | null;
  structureEntityId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): FrontingCommentResult {
  return {
    id: row.id as FrontingCommentId,
    frontingSessionId: row.frontingSessionId as FrontingSessionId,
    systemId: row.systemId as SystemId,
    memberId: (row.memberId as MemberId | null) ?? null,
    customFrontId: (row.customFrontId as CustomFrontId | null) ?? null,
    structureEntityId: (row.structureEntityId as SystemStructureEntityId | null) ?? null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/**
 * Resolves the sessionStartTime from the parent fronting session.
 * Required for the FK into the partitioned fronting_sessions table (PG only).
 */
async function resolveSessionStartTime(
  tx: PostgresJsDatabase,
  sessionId: FrontingSessionId,
  systemId: SystemId,
): Promise<number> {
  const [session] = await tx
    .select({ startTime: frontingSessions.startTime })
    .from(frontingSessions)
    .where(
      and(
        eq(frontingSessions.id, sessionId),
        eq(frontingSessions.systemId, systemId),
        eq(frontingSessions.archived, false),
      ),
    )
    .limit(1);

  if (!session) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
  }

  return session.startTime;
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateFrontingCommentBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const commentId = createId(ID_PREFIXES.frontingComment);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const sessionStartTime = await resolveSessionStartTime(tx, sessionId, systemId);

    const [row] = await tx
      .insert(frontingComments)
      .values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        memberId: parsed.memberId ?? null,
        customFrontId: parsed.customFrontId ?? null,
        structureEntityId: parsed.structureEntityId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting comment — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-comment.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment created",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listFrontingComments(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<FrontingCommentResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [
    eq(frontingComments.systemId, systemId),
    eq(frontingComments.frontingSessionId, sessionId),
    eq(frontingComments.archived, false),
  ];

  if (cursor) {
    conditions.push(lt(frontingComments.id, cursor));
  }

  const rows = await db
    .select()
    .from(frontingComments)
    .where(and(...conditions))
    .orderBy(frontingComments.createdAt, frontingComments.id)
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toFrontingCommentResult);
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  commentId: FrontingCommentId,
  auth: AuthContext,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select()
    .from(frontingComments)
    .where(
      and(
        eq(frontingComments.id, commentId),
        eq(frontingComments.systemId, systemId),
        eq(frontingComments.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
  }

  return toFrontingCommentResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  commentId: FrontingCommentId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateFrontingCommentBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.version, version),
          eq(frontingComments.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingComments.id })
          .from(frontingComments)
          .where(
            and(
              eq(frontingComments.id, commentId),
              eq(frontingComments.systemId, systemId),
              eq(frontingComments.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting comment",
    );

    await audit(tx, {
      eventType: "fronting-comment.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment updated",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: frontingComments.id })
      .from(frontingComments)
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment deleted",
      systemId,
    });

    await tx
      .delete(frontingComments)
      .where(and(eq(frontingComments.id, commentId), eq(frontingComments.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const FRONTING_COMMENT_LIFECYCLE = {
  table: frontingComments,
  columns: frontingComments,
  entityName: "Fronting comment",
  archiveEvent: "fronting-comment.archived" as const,
  restoreEvent: "fronting-comment.restored" as const,
};

export async function archiveFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, commentId, auth, audit, FRONTING_COMMENT_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  return restoreEntity(db, systemId, commentId, auth, audit, FRONTING_COMMENT_LIFECYCLE, (row) =>
    toFrontingCommentResult(row as typeof frontingComments.$inferSelect),
  );
}
