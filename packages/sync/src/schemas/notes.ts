import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";

/** CRDT representation of a Note (LWW map, keyed by NoteId). */
export interface CrdtNote extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  /** JSON-serialized "member" | "structure-entity" | null */
  authorEntityType: CrdtOptionalString;
  authorEntityId: CrdtOptionalString;
  title: CrdtString;
  content: CrdtString;
  backgroundColor: CrdtOptionalString;
  archived: boolean;
}

/**
 * Automerge document schema for notes.
 *
 * Contains private notes — member-bound, structure-entity-bound, or system-wide.
 * Time-split by year when document exceeds size threshold.
 *
 * Encryption key: Master key
 * Naming: note-{systemId} (splits to note-{systemId}-{YYYY})
 */
export interface NoteDocument {
  /** LWW map keyed by NoteId. */
  notes: Record<string, CrdtNote>;
}
