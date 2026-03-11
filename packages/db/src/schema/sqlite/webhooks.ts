import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  sqliteBinary,
  sqliteEncryptedBlob,
  sqliteJson,
  sqliteTimestamp,
} from "../../columns/sqlite.js";
import { timestamps } from "../../helpers/audit.sqlite.js";

import { apiKeys } from "./api-keys.js";
import { systems } from "./systems.js";

import type { WebhookDeliveryStatus, WebhookEventType } from "@pluralscape/types";

export const webhookConfigs = sqliteTable(
  "webhook_configs",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: sqliteBinary("secret").notNull(),
    eventTypes: sqliteJson("event_types").notNull().$type<readonly WebhookEventType[]>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    cryptoKeyId: text("crypto_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [index("webhook_configs_system_id_idx").on(t.systemId)],
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().$type<WebhookEventType>(),
    status: text("status").notNull().default("pending").$type<WebhookDeliveryStatus>(),
    httpStatus: integer("http_status"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: sqliteTimestamp("last_attempt_at"),
    nextRetryAt: sqliteTimestamp("next_retry_at"),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("webhook_deliveries_webhook_id_idx").on(t.webhookId),
    index("webhook_deliveries_system_id_idx").on(t.systemId),
    index("webhook_deliveries_status_next_retry_at_idx").on(t.status, t.nextRetryAt),
  ],
);
