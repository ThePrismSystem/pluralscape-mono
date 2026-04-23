import type { SystemId, WebhookDeliveryId, WebhookId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { WebhookEventType } from "./webhook-config.js";

/** Status of a webhook delivery attempt. */
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

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
}
