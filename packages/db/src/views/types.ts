/**
 * Shared return types for views and query helpers across PG and SQLite.
 *
 * IDs are plain `string` rather than branded types (e.g. `SystemId`) because these types
 * live at the database layer. Branded IDs are applied at the application layer when
 * converting query results into domain objects.
 */

import type { DeviceTokenPlatform, WebhookEventType } from "@pluralscape/types";

/** A currently fronting member (end_time IS NULL). */
export interface CurrentFronter {
  readonly id: string;
  readonly systemId: string;
  readonly startTime: number;
}

/** A currently fronting member with computed duration in milliseconds. */
export interface CurrentFronterWithDuration extends CurrentFronter {
  readonly durationMs: number;
}

/** An active (non-revoked) API key. */
export interface ActiveApiKey {
  readonly id: string;
  readonly accountId: string;
  readonly systemId: string;
  readonly name: string | null;
  readonly keyType: "metadata" | "crypto";
  readonly createdAt: number;
  readonly expiresAt: number | null;
}

/** Shared fields for friend connection query results. */
interface FriendConnectionBase {
  readonly id: string;
  readonly systemId: string;
  readonly friendSystemId: string;
  readonly createdAt: number;
}

/** A pending friend request. */
export type PendingFriendRequest = FriendConnectionBase;

/** A webhook delivery pending retry. */
export interface PendingWebhookRetry {
  readonly id: string;
  readonly webhookId: string;
  readonly systemId: string;
  readonly eventType: WebhookEventType;
  readonly status: "failed";
  readonly attemptCount: number;
  readonly nextRetryAt: number | null;
}

/** An unconfirmed acknowledgement. */
export interface UnconfirmedAcknowledgement {
  readonly id: string;
  readonly systemId: string;
  readonly createdAt: number;
}

/**
 * A group with its member count.
 *
 * The group `name` is absent because group data is E2E encrypted — the plaintext
 * name lives inside `groups.encryptedData` and is only available after client-side
 * decryption. This type intentionally exposes only server-visible metadata.
 */
export interface MemberGroupSummary {
  readonly groupId: string;
  readonly systemId: string;
  readonly memberCount: number;
}

/** An active (accepted) friend connection. */
export type ActiveFriendConnection = FriendConnectionBase;

/** An active (non-revoked) device token. */
export interface ActiveDeviceToken {
  readonly id: string;
  readonly accountId: string;
  readonly systemId: string;
  readonly platform: DeviceTokenPlatform;
  readonly createdAt: number;
}

/** A fronting comment on a currently active session. */
export interface CurrentFrontingComment {
  readonly commentId: string;
  readonly frontingSessionId: string;
  readonly systemId: string;
  readonly commentCreatedAt: number;
}

/** An active (non-expired, pending) device transfer request. */
export interface ActiveDeviceTransfer {
  readonly id: string;
  readonly accountId: string;
  readonly sourceSessionId: string;
  readonly targetSessionId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/** Valid link types for structure cross-links. */
export const LINK_TYPES = [
  "subsystem-layer",
  "subsystem-side-system",
  "side-system-layer",
] as const;

/** A cross-link from the structure tables (UNION of 3 link types). */
export interface StructureCrossLink {
  readonly id: string;
  readonly systemId: string;
  readonly linkType: (typeof LINK_TYPES)[number];
  readonly sourceId: string;
  readonly targetId: string;
  readonly createdAt: number;
}

/** Map a raw cross-link row to a typed StructureCrossLink with runtime linkType validation. */
export function mapStructureCrossLinkRow(row: {
  id: string;
  system_id: string;
  link_type: string;
  source_id: string;
  target_id: string;
  created_at: number;
}): StructureCrossLink {
  if (!(LINK_TYPES as readonly string[]).includes(row.link_type)) {
    throw new Error(`Unknown link_type: "${row.link_type}"`);
  }
  return {
    id: row.id,
    systemId: row.system_id,
    linkType: row.link_type as StructureCrossLink["linkType"],
    sourceId: row.source_id,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}
