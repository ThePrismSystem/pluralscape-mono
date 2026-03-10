import type { EncryptedString } from "./encryption.js";
import type { ApiKeyId, SystemId, WebhookDeliveryId, WebhookId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** Status of a webhook delivery attempt. */
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

/** Events that can trigger a webhook. */
export type WebhookEventType =
  | "member.created"
  | "member.updated"
  | "member.archived"
  | "fronting.started"
  | "fronting.ended"
  | "switch.recorded"
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
}

/** A plaintext webhook delivery payload. */
export interface PlaintextWebhookPayload {
  readonly encrypted: false;
  readonly body: Readonly<Record<string, unknown>>;
}

/** An encrypted webhook delivery payload. */
export interface EncryptedWebhookPayload {
  readonly encrypted: true;
  readonly ciphertext: string;
}

/** Discriminated union of webhook delivery payloads. */
export type WebhookDeliveryPayload = PlaintextWebhookPayload | EncryptedWebhookPayload;

/** A record of a webhook delivery attempt. */
export interface WebhookDelivery {
  readonly id: WebhookDeliveryId;
  readonly systemId: SystemId;
  readonly webhookId: WebhookId;
  readonly eventType: WebhookEventType;
  readonly payload: WebhookDeliveryPayload;
  readonly statusCode: number | null;
  readonly deliveredAt: UnixMillis;
  readonly success: boolean;
}
