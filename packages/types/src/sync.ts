import type {
  EntityType,
  SyncConflictId,
  SyncDocumentId,
  SyncQueueItemId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** The kind of operation a sync queue item represents. */
export type SyncOperation = "create" | "update" | "delete";

/** How a sync conflict was resolved. */
export type SyncResolution = "local" | "remote" | "merged";

/** Visual indicator status for the sync UI. */
export type SyncIndicatorStatus = "synced" | "syncing" | "offline" | "error";

/** Tracks an Automerge document's sync state for a particular entity. */
export interface SyncDocument {
  readonly id: SyncDocumentId;
  readonly systemId: SystemId;
  readonly entityType: EntityType;
  /** Plain string rather than branded ID — the referenced entity type varies by entityType. */
  readonly entityId: string;
  readonly automergeHeads: Uint8Array;
  readonly lastSyncedAt: UnixMillis;
  readonly version: number;
}

/** An offline write queued for sync. Replayed in order when connectivity returns. */
export interface SyncQueueItem {
  readonly id: SyncQueueItemId;
  readonly systemId: SystemId;
  readonly entityType: EntityType;
  /** Plain string rather than branded ID — the referenced entity type varies by entityType. */
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly changeData: Uint8Array;
  readonly createdAt: UnixMillis;
  readonly syncedAt: UnixMillis | null;
}

/** A recorded conflict between local and remote versions. */
export interface SyncConflict {
  readonly id: SyncConflictId;
  readonly systemId: SystemId;
  readonly entityType: EntityType;
  /** Plain string rather than branded ID — the referenced entity type varies by entityType. */
  readonly entityId: string;
  readonly localVersion: number;
  readonly remoteVersion: number;
  readonly resolution: SyncResolution;
  readonly resolvedAt: UnixMillis | null;
  readonly details: string | null;
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
