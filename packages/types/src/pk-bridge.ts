import type { EncryptedString } from "./encryption.js";
import type { GroupId, MemberId, PKBridgeConfigId, SwitchId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

// ── PK Bridge types ─────────────────────────────────────────────────
// Types for PluralKit ↔ Pluralscape synchronization.

/** Direction of sync between Pluralscape and PluralKit. */
export type PKSyncDirection = "ps-to-pk" | "pk-to-ps" | "bidirectional";

/** Status of the overall PK sync process. */
export type PKSyncStatus = "idle" | "syncing" | "error" | "paused";

/** Entity types that can be synced with PluralKit. */
export type PKSyncableEntityType = "member" | "group" | "switch";

/** Error codes for PK sync failures. */
export type PKSyncErrorCode =
  | "rate-limited"
  | "token-invalid"
  | "token-expired"
  | "entity-not-found"
  | "conflict"
  | "network-error"
  | "pk-api-error"
  | "deserialization-error"
  | "unknown";

/** Configuration for a PluralKit bridge connection. */
export interface PKBridgeConfig extends AuditMetadata {
  readonly id: PKBridgeConfigId;
  readonly systemId: SystemId;
  readonly pkToken: EncryptedString;
  readonly syncDirection: PKSyncDirection;
  readonly enabled: boolean;
  readonly lastSyncAt: UnixMillis | null;
}

/** Maps a Pluralscape member to its PluralKit counterpart. */
export interface PKMemberMapping {
  readonly psEntityType: "member";
  readonly psEntityId: MemberId;
  readonly pkEntityId: string;
  readonly lastSyncedAt: UnixMillis;
}

/** Maps a Pluralscape group to its PluralKit counterpart. */
export interface PKGroupMapping {
  readonly psEntityType: "group";
  readonly psEntityId: GroupId;
  readonly pkEntityId: string;
  readonly lastSyncedAt: UnixMillis;
}

/** Maps a Pluralscape switch to its PluralKit counterpart. */
export interface PKSwitchMapping {
  readonly psEntityType: "switch";
  readonly psEntityId: SwitchId;
  readonly pkEntityId: string;
  readonly lastSyncedAt: UnixMillis;
}

/** Maps a Pluralscape entity to its PluralKit counterpart. */
export type PKEntityMapping = PKMemberMapping | PKGroupMapping | PKSwitchMapping;

/** Current state of the PK sync process. */
export interface PKSyncState {
  readonly status: PKSyncStatus;
  readonly lastSuccessAt: UnixMillis | null;
  readonly lastErrorAt: UnixMillis | null;
  readonly pendingChanges: number;
  readonly mappings: readonly PKEntityMapping[];
}

/** Error during PK synchronization. */
export interface PKSyncError {
  readonly code: PKSyncErrorCode;
  readonly message: string;
  readonly entityId: string | null;
  readonly occurredAt: UnixMillis;
  readonly retryable: boolean;
}
