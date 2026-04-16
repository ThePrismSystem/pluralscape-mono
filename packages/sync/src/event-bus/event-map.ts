import type { SyncDocumentType } from "../document-types.js";
import type { SyncedEntityType } from "../strategies/crdt-strategies.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";

// ── Transport events ────────────────────────────────────────────────

export interface WsConnectedEvent {
  readonly type: "ws:connected";
}

export interface WsDisconnectedEvent {
  readonly type: "ws:disconnected";
  readonly reason: string;
}

export interface WsSyncMessageEvent {
  readonly type: "ws:sync-message";
  readonly documentId: string;
  readonly changes: readonly EncryptedChangeEnvelope[];
}

export interface WsNotificationEvent {
  readonly type: "ws:notification";
  readonly payload: unknown;
}

// ── Sync events ─────────────────────────────────────────────────────

export interface SyncChangesMergedEvent {
  readonly type: "sync:changes-merged";
  readonly documentId: string;
  readonly documentType: SyncDocumentType;
  readonly conflicts: readonly ConflictNotification[];
}

export interface SyncSnapshotAppliedEvent {
  readonly type: "sync:snapshot-applied";
  readonly documentId: string;
  readonly documentType: SyncDocumentType;
}

export interface SyncErrorEvent {
  readonly type: "sync:error";
  readonly message: string;
  readonly error: unknown;
}

// ── Data-layer events ───────────────────────────────────────────────

export interface DataErrorEvent {
  readonly type: "data:error";
  readonly message: string;
  readonly error: unknown;
}

// ── Materialization events ──────────────────────────────────────────

export type EntityOperation = "create" | "update" | "delete";

export interface MaterializedDocumentEvent {
  readonly type: "materialized:document";
  readonly documentType: SyncDocumentType;
}

export interface MaterializedEntityEvent {
  readonly type: "materialized:entity";
  readonly documentType: SyncDocumentType;
  readonly entityType: SyncedEntityType;
  readonly entityId: string;
  readonly op: EntityOperation;
}

// ── Friend events ───────────────────────────────────────────────────

export interface FriendDataChangedEvent {
  readonly type: "friend:data-changed";
  readonly connectionId: string;
}

export interface FriendIndexedEvent {
  readonly type: "friend:indexed";
  readonly connectionId: string;
}

// ── Search events ───────────────────────────────────────────────────

export type SearchScope = "self" | "friend";

export interface SearchIndexUpdatedEvent {
  readonly type: "search:index-updated";
  readonly scope: SearchScope;
  readonly documentType?: SyncDocumentType;
}

// ── Event map ───────────────────────────────────────────────────────

export interface DataLayerEventMap {
  "ws:connected": WsConnectedEvent;
  "ws:disconnected": WsDisconnectedEvent;
  "ws:sync-message": WsSyncMessageEvent;
  "ws:notification": WsNotificationEvent;
  "sync:changes-merged": SyncChangesMergedEvent;
  "sync:snapshot-applied": SyncSnapshotAppliedEvent;
  "sync:error": SyncErrorEvent;
  "data:error": DataErrorEvent;
  "materialized:document": MaterializedDocumentEvent;
  "materialized:entity": MaterializedEntityEvent;
  "friend:data-changed": FriendDataChangedEvent;
  "friend:indexed": FriendIndexedEvent;
  "search:index-updated": SearchIndexUpdatedEvent;
}

export type DataLayerEventType = keyof DataLayerEventMap;
export type DataLayerEvent = DataLayerEventMap[DataLayerEventType];
