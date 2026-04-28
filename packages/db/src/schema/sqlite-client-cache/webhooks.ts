import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { ApiKeyId, WebhookEventType, WebhookId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `WebhookConfig`. The cache mirrors
 * the user-visible config — `url`, `eventTypes`, `enabled`, `cryptoKeyId` —
 * so the local UI can list and edit endpoints. The HMAC `secret` is
 * intentionally omitted: it is server-only T3 metadata that the dispatcher
 * loads at delivery time and must never replicate to a friend's cache.
 */
export const webhookConfigs = sqliteTable("webhook_configs", {
  ...entityIdentity<WebhookId>(),
  url: text("url").notNull(),
  eventTypes: sqliteJsonOf<readonly WebhookEventType[]>("event_types").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  cryptoKeyId: brandedId<ApiKeyId>("crypto_key_id"),
  ...timestamps(),
  ...archivable(),
});

export type LocalWebhookConfigRow = InferSelectModel<typeof webhookConfigs>;
export type NewLocalWebhookConfig = InferInsertModel<typeof webhookConfigs>;
