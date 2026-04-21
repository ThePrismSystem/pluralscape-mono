import { webhookConfigs } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { resolveAndValidateUrl } from "../../lib/ip-validation.js";
import { WEBHOOK_REQUIRED_PROTOCOL } from "../../service.constants.js";

import type {
  ApiKeyId,
  ServerSecret,
  SystemId,
  UnixMillis,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────────

export interface WebhookConfigResult {
  readonly id: WebhookId;
  readonly systemId: SystemId;
  readonly url: string;
  readonly eventTypes: readonly WebhookEventType[];
  readonly enabled: boolean;
  /**
   * API key that encrypts delivery payloads at rest in the database. Null
   * when the webhook emits plaintext payloads. Matches the canonical
   * `WebhookConfig.cryptoKeyId` brand in @pluralscape/types.
   */
  readonly cryptoKeyId: ApiKeyId | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/**
 * Returned from create/rotate only — includes the raw secret for the caller
 * to store. `secret` is the base64-encoded form of a `ServerSecret`
 * (Uint8Array). Exposing it as `string` here is deliberate: the server
 * serializes the HMAC signing key to base64 before it hits the wire, and
 * callers never need the raw bytes. Keep the branded Uint8Array type for
 * the in-memory path via `WebhookConfigCreateResult.secretBytes`.
 */
export interface WebhookConfigCreateResult extends WebhookConfigResult {
  /** Base64-encoded form of the newly-generated HMAC signing secret. */
  readonly secret: string;
  /** Raw branded bytes for any caller that needs to sign inline. */
  readonly secretBytes: ServerSecret;
}

// ── Shared select columns ────────────────────────────────────────────

export const WEBHOOK_CONFIG_SELECT_COLUMNS = {
  id: webhookConfigs.id,
  systemId: webhookConfigs.systemId,
  url: webhookConfigs.url,
  eventTypes: webhookConfigs.eventTypes,
  enabled: webhookConfigs.enabled,
  cryptoKeyId: webhookConfigs.cryptoKeyId,
  version: webhookConfigs.version,
  archived: webhookConfigs.archived,
  archivedAt: webhookConfigs.archivedAt,
  createdAt: webhookConfigs.createdAt,
  updatedAt: webhookConfigs.updatedAt,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

export function toWebhookConfigResult(row: {
  id: string;
  systemId: string;
  url: string;
  eventTypes: readonly WebhookEventType[];
  enabled: boolean;
  cryptoKeyId: string | null;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): WebhookConfigResult {
  return {
    id: brandId<WebhookId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    url: row.url,
    eventTypes: row.eventTypes,
    enabled: row.enabled,
    // DB returns `string | null`; brand it here so every caller consumes
    // the canonical ApiKeyId shape without needing a downstream cast.
    cryptoKeyId: row.cryptoKeyId === null ? null : brandId<ApiKeyId>(row.cryptoKeyId),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/**
 * Narrow a freshly-generated Uint8Array into a `ServerSecret` without a
 * double-cast. The brand is a compile-time phantom; the runtime bytes are
 * the bytes `randomBytes` produced.
 *
 * Exported so test helpers can produce a valid `ServerSecret` without
 * reaching for an `as unknown as ServerSecret` double-cast.
 */
export function toServerSecret(bytes: Uint8Array): ServerSecret {
  return bytes as ServerSecret;
}

/** Localhost patterns exempt from the HTTPS requirement. */
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Validate a webhook URL for protocol and SSRF safety.
 *
 * - Always enforces HTTPS, with an exemption for localhost/127.0.0.1/::1.
 * - Resolves the hostname and checks all resolved IPs against private/reserved ranges.
 */
export async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  const isLocalhost = LOCALHOST_HOSTS.has(parsed.hostname);

  if (!isLocalhost && !url.startsWith(WEBHOOK_REQUIRED_PROTOCOL)) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Webhook URL must use HTTPS");
  }

  try {
    await resolveAndValidateUrl(url);
  } catch (error: unknown) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Webhook URL validation failed",
    );
  }
}
