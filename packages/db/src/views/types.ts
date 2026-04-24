/**
 * Shared return types for views and query helpers across PG and SQLite.
 *
 * IDs on most views are plain `string` rather than branded types — these types
 * historically lived at the database layer before brand lift. Brand-lifted
 * view types (per cluster) import their branded IDs directly and propagate
 * the brand through the select().
 */

import type {
  AcknowledgementId,
  DeviceTokenPlatform,
  SystemId,
  WebhookEventType,
} from "@pluralscape/types";

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
  readonly keyType: "metadata" | "crypto";
  readonly createdAt: number;
  readonly expiresAt: number | null;
}

/** Shared fields for friend connection query results. */
interface FriendConnectionBase {
  readonly id: string;
  readonly accountId: string;
  readonly friendAccountId: string;
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
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
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
  readonly targetSessionId: string | null;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/** A structure entity association from the associations table. */
export interface StructureEntityAssociationRow {
  readonly id: string;
  readonly systemId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly createdAt: number;
}
