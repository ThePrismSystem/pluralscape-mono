/**
 * Strongly-typed sync session variants.
 *
 * SyncEngine stores sessions in a discriminated union keyed by `documentType`,
 * so a single narrow step yields the concrete CRDT shape.
 *
 * Usage:
 *   const session = engine.getSession(docId);       // AnyDocumentSession
 *   if (session.documentType === "system-core") {
 *     // session.session typed as EncryptedSyncSession<Record<string, unknown>>
 *   }
 *   // Or for one-step narrowing:
 *   const s = engine.getTypedSession(docId, "system-core");
 */
import type { SyncDocumentType } from "../document-types.js";
import type { BucketProjectionDocument } from "../schemas/bucket.js";
import type { ChatDocument } from "../schemas/chat.js";
import type { FrontingDocument } from "../schemas/fronting.js";
import type { JournalDocument } from "../schemas/journal.js";
import type { NoteDocument } from "../schemas/notes.js";
import type { PrivacyConfigDocument } from "../schemas/privacy-config.js";
import type { SystemCoreDocument } from "../schemas/system-core.js";
import type { EncryptedSyncSession } from "../sync-session.js";

/**
 * Map of document type discriminant → concrete CRDT document shape.
 *
 * This is the *logical* shape of each document's root. Internally the sync
 * engine still stores sessions as `EncryptedSyncSession<Record<string,
 * unknown>>` because the engine performs dynamic field access across all
 * document types; the map is consumed by typed accessors and callers that
 * need the concrete shape.
 */
export interface DocumentTypeMap {
  readonly "system-core": SystemCoreDocument;
  readonly fronting: FrontingDocument;
  readonly chat: ChatDocument;
  readonly journal: JournalDocument;
  readonly note: NoteDocument;
  readonly "privacy-config": PrivacyConfigDocument;
  readonly bucket: BucketProjectionDocument;
}

/**
 * A sync session tagged with its document-type discriminant. The embedded
 * session is typed at `Record<string, unknown>` (the storage-level shape)
 * so that the map storing all variants is type-stable. Consumers that want
 * the concrete CRDT shape read `session.document` and cast to
 * `DocumentTypeMap[T]` — the discriminant guarantees the cast is sound.
 */
export type DocumentSession<T extends SyncDocumentType> = {
  readonly documentType: T;
  readonly session: EncryptedSyncSession<Record<string, unknown>>;
};

/** Discriminated union over all known document types. */
export type AnyDocumentSession = {
  [K in SyncDocumentType]: DocumentSession<K>;
}[SyncDocumentType];
