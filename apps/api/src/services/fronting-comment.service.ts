import { frontingComments, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateFrontingCommentBodySchema,
  UpdateFrontingCommentBodySchema,
} from "@pluralscape/validation";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { validateSubjectIds } from "../lib/validate-subject-ids.js";
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
    memberId: row.memberId as MemberId | null,
    customFrontId: row.customFrontId as CustomFrontId | null,
    structureEntityId: row.structureEntityId as SystemStructureEntityId | null,
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
    .select({ startTime: frontingSessions.startTime, archived: frontingSessions.archived })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
    .limit(1);

  if (!session) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
  }

  if (session.archived) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "SESSION_ARCHIVED",
      "Cannot add comments to an archived session",
    );
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
    await validateSubjectIds(tx, systemId, parsed);

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
  opts?: { cursor?: string; limit?: number; includeArchived?: boolean },
): Promise<PaginatedResult<FrontingCommentResult>> {
  assertSystemOwnership(systemId, auth);

  // Verify parent session exists and belongs to this system
  const [session] = await db
    .select({ id: frontingSessions.id })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
    .limit(1);

  if (!session) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
  }

  const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const conditions = [
    eq(frontingComments.systemId, systemId),
    eq(frontingComments.frontingSessionId, sessionId),
  ];

  if (!opts?.includeArchived) {
    conditions.push(eq(frontingComments.archived, false));
  }

  if (opts?.cursor) {
    conditions.push(lt(frontingComments.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(frontingComments)
    .where(and(...conditions))
    .orderBy(desc(frontingComments.id))
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toFrontingCommentResult);
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  // Verify parent session exists and belongs to this system
  const [session] = await db
    .select({ id: frontingSessions.id })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
    .limit(1);

  if (!session) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
  }

  const [row] = await db
    .select()
    .from(frontingComments)
    .where(
      and(
        eq(frontingComments.id, commentId),
        eq(frontingComments.systemId, systemId),
        eq(frontingComments.frontingSessionId, sessionId),
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
  sessionId: FrontingSessionId,
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
          eq(frontingComments.frontingSessionId, sessionId),
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
              eq(frontingComments.frontingSessionId, sessionId),
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
  sessionId: FrontingSessionId,
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
          eq(frontingComments.frontingSessionId, sessionId),
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
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
        ),
      );
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, false),
        ),
      )
      .returning({ id: frontingComments.id });

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: frontingComments.id })
        .from(frontingComments)
        .where(
          and(
            eq(frontingComments.id, commentId),
            eq(frontingComments.systemId, systemId),
            eq(frontingComments.frontingSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Fronting comment is already archived",
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, true),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const [existing] = await tx
        .select({ id: frontingComments.id })
        .from(frontingComments)
        .where(
          and(
            eq(frontingComments.id, commentId),
            eq(frontingComments.systemId, systemId),
            eq(frontingComments.frontingSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "NOT_ARCHIVED", "Fronting comment is not archived");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment restored",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}
