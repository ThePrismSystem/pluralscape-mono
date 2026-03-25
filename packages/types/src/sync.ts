import type { SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** Sync document types matching the document topology spec. */
export type SyncDocumentType =
  | "system-core"
  | "fronting"
  | "chat"
  | "journal"
  | "note"
  | "privacy-config"
  | "bucket";

/** Which encryption key tier a document uses. */
export type DocumentKeyType = "derived" | "bucket";

/** Visual indicator status for the sync UI. */
export type SyncIndicatorStatus = "synced" | "syncing" | "offline" | "error";

/** Server-side sync document metadata (document-level, not entity-level). */
export interface SyncDocument {
  readonly documentId: string;
  readonly systemId: SystemId;
  readonly docType: SyncDocumentType;
  readonly sizeBytes: number;
  readonly snapshotVersion: number;
  readonly lastSeq: number;
  readonly archived: boolean;
  readonly timePeriod: string | null;
  readonly keyType: DocumentKeyType;
  readonly bucketId: string | null;
  readonly channelId: string | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Overall sync status for a system. Runtime state, not persisted. */
export interface SyncState {
  readonly lastSyncedAt: UnixMillis | null;
  readonly pendingChanges: number;
  readonly syncInProgress: boolean;
}

/** UI state for the visual sync indicator. Runtime state, not persisted. */
export interface SyncIndicator {
  readonly status: SyncIndicatorStatus;
  readonly lastSyncedAt: UnixMillis | null;
  readonly pendingCount: number;
}
