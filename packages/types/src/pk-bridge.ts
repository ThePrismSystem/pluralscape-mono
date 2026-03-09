import type { UnixMillis } from "./timestamps.js";

// ── PK Bridge types ─────────────────────────────────────────────────
// Types for PluralKit ↔ Pluralscape synchronization.

/** Direction of sync between Pluralscape and PluralKit. */
export type PKSyncDirection = "ps-to-pk" | "pk-to-ps" | "bidirectional";

/** Status of the overall PK sync process. */
export type PKSyncStatus = "idle" | "syncing" | "error" | "paused";

/** Configuration for a PluralKit bridge connection. */
export interface PKBridgeConfig {
  readonly systemId: string;
  readonly pkToken: string;
  readonly syncDirection: PKSyncDirection;
  readonly enabled: boolean;
  readonly lastSyncAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Maps a Pluralscape entity to its PluralKit counterpart. */
export interface PKEntityMapping {
  readonly psEntityId: string;
  readonly psEntityType: "member" | "group";
  readonly pkEntityId: string;
  readonly lastSyncedAt: UnixMillis;
}

/** Current state of the PK sync process. */
export interface PKSyncState {
  readonly status: PKSyncStatus;
  readonly lastSuccessAt: UnixMillis | null;
  readonly lastErrorAt: UnixMillis | null;
  readonly pendingChanges: number;
  readonly mappings: readonly PKEntityMapping[];
}

/** Error that occurred during PK synchronization. */
export interface PKSyncError {
  readonly code: string;
  readonly message: string;
  readonly entityId: string | null;
  readonly occurredAt: UnixMillis;
  readonly retryable: boolean;
}
