import type { EncryptedString } from "./encryption.js";
import type { ApiKeyId, SystemId, WebhookDeliveryId, WebhookId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** Status of a webhook delivery attempt. */
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

/** Events that can trigger a webhook. */
export type WebhookEventType =
  | "member.created"
  | "member.updated"
  | "member.archived"
  | "fronting.started"
  | "fronting.ended"
  | "group.created"
  | "group.updated"
  | "note.created"
  | "note.updated"
  | "chat.message-sent"
  | "poll.created"
  | "poll.closed"
  | "acknowledgement.requested"
  | "lifecycle.event-recorded"
  | "custom-front.changed";

/** Configuration for a webhook endpoint. */
export interface WebhookConfig extends AuditMetadata {
  readonly id: WebhookId;
  readonly systemId: SystemId;
  readonly url: string;
  readonly secret: EncryptedString;
  readonly eventTypes: readonly WebhookEventType[];
  readonly enabled: boolean;
  /** Crypto key for encrypted webhook payloads. Null for plaintext delivery. */
  readonly cryptoKeyId: ApiKeyId | null;
  readonly archived: false;
}

/** An archived webhook config. */
export type ArchivedWebhookConfig = Archived<WebhookConfig>;

/** A record of a webhook delivery attempt with retry lifecycle. */
export interface WebhookDelivery {
  readonly id: WebhookDeliveryId;
  readonly systemId: SystemId;
  readonly webhookId: WebhookId;
  readonly eventType: WebhookEventType;
  readonly status: WebhookDeliveryStatus;
  readonly httpStatus: number | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: UnixMillis | null;
  readonly nextRetryAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

/** An archived webhook delivery. */
export interface ArchivedWebhookDelivery extends Omit<WebhookDelivery, "archived"> {
  readonly archived: true;
}

/** Maps each webhook event type to its expected payload shape. Placeholder for future per-event typing. */
export type WebhookEventPayloadMap = { [K in WebhookEventType]: Record<string, unknown> };
