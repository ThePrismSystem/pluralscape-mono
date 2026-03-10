import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { WEBHOOK_DELIVERY_STATUSES, WEBHOOK_EVENT_TYPES } from "../../helpers/enums.js";

import { apiKeys } from "./api-keys.js";
import { systems } from "./systems.js";

import type { WebhookDeliveryStatus, WebhookEventType } from "@pluralscape/types";

export const webhookConfigs = pgTable(
  "webhook_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 2048 }).notNull(),
    secret: pgBinary("secret").notNull(),
    eventTypes: jsonb("event_types").notNull().$type<readonly WebhookEventType[]>(),
    enabled: boolean("enabled").notNull().default(true),
    cryptoKeyId: varchar("crypto_key_id", { length: 255 }).references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [index("webhook_configs_system_id_idx").on(t.systemId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    webhookId: varchar("webhook_id", { length: 255 })
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 255 }).notNull().$type<WebhookEventType>(),
    status: varchar("status", { length: 255 })
      .notNull()
      .default("pending")
      .$type<WebhookDeliveryStatus>(),
    httpStatus: integer("http_status"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: pgTimestamp("last_attempt_at"),
    nextRetryAt: pgTimestamp("next_retry_at"),
    encryptedData: pgBinary("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("webhook_deliveries_webhook_id_idx").on(t.webhookId),
    index("webhook_deliveries_system_id_idx").on(t.systemId),
    index("webhook_deliveries_status_next_retry_at_idx").on(t.status, t.nextRetryAt),
    check("webhook_deliveries_event_type_check", enumCheck(t.eventType, WEBHOOK_EVENT_TYPES)),
    check("webhook_deliveries_status_check", enumCheck(t.status, WEBHOOK_DELIVERY_STATUSES)),
    check("webhook_deliveries_attempt_count_check", sql`${t.attemptCount} >= 0`),
    check(
      "webhook_deliveries_http_status_check",
      sql`${t.httpStatus} IS NULL OR (${t.httpStatus} >= 100 AND ${t.httpStatus} <= 599)`,
    ),
  ],
);
