import { notes } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreateNoteBodySchema, UpdateNoteBodySchema } from "@pluralscape/validation";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  NoteAuthorEntityType,
  NoteId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface NoteResult {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: string | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListNoteOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly authorEntityType?: NoteAuthorEntityType;
  readonly authorEntityId?: string;
  readonly systemWide?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toNoteResult(row: typeof notes.$inferSelect): NoteResult {
  return {
    id: row.id as NoteId,
    systemId: row.systemId as SystemId,
    authorEntityType: row.authorEntityType as NoteAuthorEntityType | null,
    authorEntityId: row.authorEntityId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateNoteBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const noteId = createId(ID_PREFIXES.note);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(notes)
      .values({
        id: noteId,
        systemId,
        authorEntityType: parsed.author?.entityType ?? null,
        authorEntityId: parsed.author?.entityId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create note — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "note.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Note created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "note.created", {
      noteId: row.id as NoteId,
    });

    return toNoteResult(row);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.systemId, systemId), eq(notes.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Note not found");
    }

    return toNoteResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listNotes(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListNoteOpts = {},
): Promise<PaginatedResult<NoteResult>> {
  assertSystemOwnership(systemId, auth);

  if (
    opts.systemWide &&
    (opts.authorEntityType !== undefined || opts.authorEntityId !== undefined)
  ) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "systemWide cannot be combined with author filters",
    );
  }

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(notes.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(notes.archived, false));
    }

    if (opts.systemWide) {
      conditions.push(isNull(notes.authorEntityType));
    }

    if (opts.authorEntityType !== undefined) {
      conditions.push(eq(notes.authorEntityType, opts.authorEntityType));
    }

    if (opts.authorEntityId !== undefined) {
      conditions.push(eq(notes.authorEntityId, opts.authorEntityId));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "note");
      // or() returns SQL | undefined in drizzle types; always defined with concrete args
      const cursorCondition = or(
        lt(notes.createdAt, decoded.sortValue),
        and(eq(notes.createdAt, decoded.sortValue), lt(notes.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toNoteResult);
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? toCompositeCursor(lastItem.createdAt, lastItem.id) : null;

    return { items, nextCursor, hasMore, totalCount: null };
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

/**
 * Updates a note's encrypted data with optimistic concurrency control.
 * Author (entityType/entityId) is immutable after creation.
 */
export async function updateNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateNoteBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(notes)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${notes.version} + 1`,
      })
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.systemId, systemId),
          eq(notes.version, version),
          eq(notes.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.id, noteId), eq(notes.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Note",
    );

    await audit(tx, {
      eventType: "note.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Note updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "note.updated", {
      noteId: row.id as NoteId,
    });

    return toNoteResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.systemId, systemId), eq(notes.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Note not found");
    }

    await audit(tx, {
      eventType: "note.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Note deleted",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "note.deleted", {
      noteId: noteId,
    });

    await tx.delete(notes).where(and(eq(notes.id, noteId), eq(notes.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const NOTE_LIFECYCLE: ArchivableEntityConfig<NoteId> = {
  table: notes,
  columns: notes,
  entityName: "Note",
  archiveEvent: "note.archived" as const,
  restoreEvent: "note.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "note.archived", { noteId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "note.restored", { noteId: eid }),
};

export async function archiveNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, noteId, auth, audit, NOTE_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NoteResult> {
  return restoreEntity(db, systemId, noteId, auth, audit, NOTE_LIFECYCLE, (row) =>
    toNoteResult(row as typeof notes.$inferSelect),
  );
}
