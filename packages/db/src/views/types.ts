/** Shared return types for views and query helpers across PG and SQLite. */

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
  readonly name: string;
  readonly keyType: "metadata" | "crypto";
  readonly createdAt: number;
  readonly expiresAt: number | null;
}

/** A pending friend request. */
export interface PendingFriendRequest {
  readonly id: string;
  readonly systemId: string;
  readonly friendSystemId: string;
  readonly createdAt: number;
}

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
  readonly targetMemberId: string | null;
  readonly createdAt: number;
}

/** A group with its member count. */
export interface MemberGroupSummary {
  readonly groupId: string;
  readonly systemId: string;
  readonly memberCount: number;
}

/** An active (accepted) friend connection. */
export interface ActiveFriendConnection {
  readonly id: string;
  readonly systemId: string;
  readonly friendSystemId: string;
  readonly createdAt: number;
}

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
  readonly sessionId: string;
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

/** A cross-link from the structure tables (UNION of 3 link types). */
export interface StructureCrossLink {
  readonly id: string;
  readonly systemId: string;
  readonly linkType: "subsystem-layer" | "subsystem-side-system" | "side-system-layer";
  readonly sourceId: string;
  readonly targetId: string;
  readonly createdAt: number;
}
