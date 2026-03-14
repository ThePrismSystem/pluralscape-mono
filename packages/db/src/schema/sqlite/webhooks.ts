import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import {
  sqliteBinary,
  sqliteEncryptedBlob,
  sqliteJson,
  sqliteTimestamp,
} from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
} from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { WEBHOOK_DELIVERY_STATUSES, WEBHOOK_EVENT_TYPES } from "../../helpers/enums.js";

import { apiKeys } from "./api-keys.js";
import { systems } from "./systems.js";

import type { WebhookDeliveryStatus, WebhookEventType } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const webhookConfigs = sqliteTable(
  "webhook_configs",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** T3 (server-readable): raw HMAC signing key the server uses to sign outbound webhook payloads. Intentionally not E2E encrypted — server must read it to produce signatures at delivery time. */
    secret: sqliteBinary("secret").notNull(),
    eventTypes: sqliteJson("event_types").notNull().$type<readonly WebhookEventType[]>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    cryptoKeyId: text("crypto_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    index("webhook_configs_system_archived_idx").on(t.systemId, t.archived),
    unique("webhook_configs_id_system_id_unique").on(t.id, t.systemId),
    archivableConsistencyCheckFor("webhook_configs", t.archived, t.archivedAt),
  ],
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id").notNull(),
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
    ...archivable(),
  },
  (t) => [
    index("webhook_deliveries_webhook_id_idx").on(t.webhookId),
    index("webhook_deliveries_system_id_idx").on(t.systemId),
    index("webhook_deliveries_status_next_retry_at_idx").on(t.status, t.nextRetryAt),
    index("webhook_deliveries_terminal_created_at_idx")
      .on(t.createdAt)
      .where(sql`${t.status} IN ('success', 'failed')`),
    index("webhook_deliveries_system_retry_idx")
      .on(t.systemId, t.status, t.nextRetryAt)
      .where(sql`${t.status} NOT IN ('success', 'failed')`),
    foreignKey({
      columns: [t.webhookId, t.systemId],
      foreignColumns: [webhookConfigs.id, webhookConfigs.systemId],
    }).onDelete("cascade"),
    check("webhook_deliveries_event_type_check", enumCheck(t.eventType, WEBHOOK_EVENT_TYPES)),
    check("webhook_deliveries_status_check", enumCheck(t.status, WEBHOOK_DELIVERY_STATUSES)),
    check("webhook_deliveries_attempt_count_check", sql`${t.attemptCount} >= 0`),
    check(
      "webhook_deliveries_http_status_check",
      sql`${t.httpStatus} IS NULL OR (${t.httpStatus} >= 100 AND ${t.httpStatus} <= 599)`,
    ),
    archivableConsistencyCheckFor("webhook_deliveries", t.archived, t.archivedAt),
  ],
);

export type WebhookConfigRow = InferSelectModel<typeof webhookConfigs>;
export type NewWebhookConfig = InferInsertModel<typeof webhookConfigs>;
export type WebhookDeliveryRow = InferSelectModel<typeof webhookDeliveries>;
export type NewWebhookDelivery = InferInsertModel<typeof webhookDeliveries>;
