import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { ApiKeyId, ServerSecret, WebhookEventType, WebhookId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `WebhookConfig`. The HMAC `secret`
 * is server-only T3 metadata; the cache mirrors the column so the local
 * UI can display the config without revealing the secret to friends.
 */
export const webhookConfigs = sqliteTable("webhook_configs", {
  ...entityIdentity<WebhookId>(),
  url: text("url").notNull(),
  secret: text("secret").$type<ServerSecret>().notNull(),
  eventTypes: sqliteJsonOf<readonly WebhookEventType[]>("event_types").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  cryptoKeyId: brandedId<ApiKeyId>("crypto_key_id"),
  ...timestamps(),
  ...archivable(),
});

export type LocalWebhookConfigRow = InferSelectModel<typeof webhookConfigs>;
export type NewLocalWebhookConfig = InferInsertModel<typeof webhookConfigs>;
