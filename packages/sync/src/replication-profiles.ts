import { DEFAULT_ACTIVE_CHANNEL_WINDOW_DAYS } from "./sync.constants.js";

import type { SyncManifestEntry } from "./adapters/network-adapter.js";

// ── Replication profile types ────────────────────────────────────────

/** Identifies which replication strategy a client uses. */
export type ReplicationProfileType = "owner-full" | "owner-lite" | "friend";

/** Owner (full) profile: syncs all documents. Used on primary devices with no storage constraints. */
export interface OwnerFullProfile {
  readonly profileType: "owner-full";
}

/**
 * Owner (lite) profile: syncs only current-period documents and active channels.
 * Used on low-storage devices (wearables, budget phones).
 */
export interface OwnerLiteProfile {
  readonly profileType: "owner-lite";
  /**
   * Number of days since last update within which a chat channel is considered active.
   * Channels outside this window are excluded unless pinned.
   * Must be a positive integer (1-365).
   * Default: 30 days.
   */
  readonly activeChannelWindowDays: number;
}

/** Friend profile: syncs only bucket documents for which the friend has a non-revoked KeyGrant. */
export interface FriendProfile {
  readonly profileType: "friend";
  /** The friend's system ID, used to filter KeyGrants. */
  readonly friendSystemId: string;
  /** Bucket IDs for which the friend has an active (non-revoked) KeyGrant. */
  readonly grantedBucketIds: readonly string[];
}

/** Union of all replication profile configurations. */
export type ReplicationProfile = OwnerFullProfile | OwnerLiteProfile | FriendProfile;

// ── Document sync state ───────────────────────────────────────────────

/**
 * Tracks the local sync position for a single document.
 * Persisted alongside the document in local storage.
 */
export interface DocumentSyncState {
  /** The document ID (matches SyncManifestEntry.docId). */
  readonly docId: string;
  /** Highest encrypted change seq applied locally. 0 if only loaded from snapshot. */
  readonly lastSyncedSeq: number;
  /** Snapshot version applied at bootstrap (0 if no snapshot loaded yet). */
  readonly lastSnapshotVersion: number;
  /**
   * True if this document was loaded on-demand rather than via active subscription.
   * On-demand documents are not automatically re-synced on reconnect.
   */
  readonly onDemand: boolean;
}

// ── Subscription set ──────────────────────────────────────────────────

/**
 * Result of applying a replication profile filter to a manifest.
 * Computed client-side for owner profiles; server applies friend filtering before manifest delivery.
 */
export interface SubscriptionSet {
  /** Documents to actively subscribe to (receive real-time updates for). */
  readonly active: readonly SyncManifestEntry[];
  /**
   * Documents in the manifest but not in the active set.
   * Available for on-demand loading but not automatically synced.
   */
  readonly available: readonly SyncManifestEntry[];
  /**
   * Document IDs present in local storage but not in the manifest or no longer subscribed.
   * These should be evicted from local storage.
   */
  readonly evict: readonly string[];
}

// ── On-demand document loading ────────────────────────────────────────

/**
 * Request to load a document that is not in the active subscription set.
 * Used for loading historical periods, lite-profile journal entries, and other
 * non-subscribed documents on user demand.
 */
export interface OnDemandLoadRequest {
  /** The document ID to load. Must be in the manifest and pass access checks. */
  readonly docId: string;
  /**
   * If true, the loaded document is persisted to local storage and included
   * in future sync (as an on-demand document, not a subscription).
   * If false, the document is kept in memory only for the current session.
   */
  readonly persist: boolean;
}

// ── Default configurations ────────────────────────────────────────────

/** Default owner-full profile (no configuration required). */
export const DEFAULT_OWNER_FULL_PROFILE: OwnerFullProfile = {
  profileType: "owner-full",
} as const;

/** Default owner-lite configuration: 30-day active channel window. */
export const DEFAULT_OWNER_LITE_PROFILE: OwnerLiteProfile = {
  profileType: "owner-lite",
  activeChannelWindowDays: DEFAULT_ACTIVE_CHANNEL_WINDOW_DAYS,
} as const;
