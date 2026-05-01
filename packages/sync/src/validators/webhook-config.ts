import { WEBHOOK_EVENT_TYPE_VALUES } from "@pluralscape/validation";

import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type * as Automerge from "@automerge/automerge";

interface WebhookConfigLike {
  url: Automerge.ImmutableString;
  eventTypes: unknown[];
  enabled: boolean;
}

/** Valid webhook event types for post-merge validation. */
const VALID_WEBHOOK_EVENT_TYPES: ReadonlySet<string> = new Set(WEBHOOK_EVENT_TYPE_VALUES);

/**
 * Validates webhook configs after merge:
 * - URL format: must be a valid URL (HTTPS required in production, but post-merge
 *   only checks URL starts with http:// or https://)
 * - eventTypes: all values must be from the WebhookEventType enum
 *
 * Invalid entries generate notifications only (no auto-fix to avoid data loss).
 * Returns the count of issues and notifications.
 */
export function normalizeWebhookConfigs(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const timestamp = Date.now();
  const notifications: ConflictNotification[] = [];

  const configs = getEntityMap<WebhookConfigLike>(doc, "webhookConfigs");
  if (!configs) return { count: 0, notifications, envelope: null };

  let issueCount = 0;

  for (const [configId, config] of Object.entries(configs)) {
    const urlVal = typeof config.url === "object" ? config.url.val : null;
    if (urlVal !== null) {
      try {
        const parsed = new URL(urlVal);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          notifications.push({
            entityType: "webhook-config",
            entityId: configId,
            fieldName: "url",
            resolution: "notification-only",
            detectedAt: timestamp,
            summary: `Webhook config ${configId} has non-HTTP(S) URL: ${urlVal}`,
          });
          issueCount++;
        }
      } catch {
        notifications.push({
          entityType: "webhook-config",
          entityId: configId,
          fieldName: "url",
          resolution: "notification-only",
          detectedAt: timestamp,
          summary: `Webhook config ${configId} has invalid URL format`,
        });
        issueCount++;
      }
    }

    if (Array.isArray(config.eventTypes)) {
      for (const eventType of config.eventTypes) {
        const val =
          typeof eventType === "object" && eventType !== null && "val" in eventType
            ? (eventType as { val: string }).val
            : typeof eventType === "string"
              ? eventType
              : null;

        if (val === null || !VALID_WEBHOOK_EVENT_TYPES.has(val)) {
          notifications.push({
            entityType: "webhook-config",
            entityId: configId,
            fieldName: "eventTypes",
            resolution: "notification-only",
            detectedAt: timestamp,
            summary: `Webhook config ${configId} has unknown event type: ${String(val)}`,
          });
          issueCount++;
          break;
        }
      }
    }
  }

  return { count: issueCount, notifications, envelope: null };
}
