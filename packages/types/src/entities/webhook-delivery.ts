import type { T3EncryptedBytes } from "../encryption-primitives.js";
import type { SystemId, WebhookDeliveryId, WebhookId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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

/**
 * Server-visible webhook delivery metadata — raw Drizzle row shape.
 *
 * Derived from `WebhookDelivery` by adding the server-only
 * `encryptedData` column — the T3-encrypted payload the server stores
 * to sign at delivery time. The payload itself is encrypted with a
 * server-held key (not E2E), so it's `T3EncryptedBytes` not
 * `EncryptedBlob` — see ADR-023 Class E.
 */
export type WebhookDeliveryServerMetadata = WebhookDelivery & {
  readonly encryptedData: T3EncryptedBytes;
};

/**
 * JSON-wire representation of WebhookDelivery. Derived from the domain
 * type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`.
 *
 * NB: Wire is derived from the domain type (not
 * `WebhookDeliveryServerMetadata`) because the server row carries the
 * server-held T3 `encryptedData` payload (used to sign at delivery
 * time) which the API does not expose.
 */
export type WebhookDeliveryWire = Serialize<WebhookDelivery>;
