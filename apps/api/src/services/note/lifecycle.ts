import { notes } from "@pluralscape/db/pg";

import { archiveEntity, deleteEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toNoteResult } from "./internal.js";

import type { NoteResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { NoteId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const NOTE_DELETE: DeletableEntityConfig<NoteId> = {
  table: notes,
  columns: notes,
  entityName: "Note",
  deleteEvent: "note.deleted",
  onDelete: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "note.deleted", { noteId: eid }),
};

const NOTE_LIFECYCLE: ArchivableEntityConfig<NoteId> = {
  table: notes,
  columns: notes,
  entityName: "Note",
  archiveEvent: "note.archived" as const,
  restoreEvent: "note.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "note.archived", { noteId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "note.restored", { noteId: eid }),
};

export async function deleteNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, noteId, auth, audit, NOTE_DELETE);
}

export async function archiveNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, noteId, auth, audit, NOTE_LIFECYCLE);
}

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
