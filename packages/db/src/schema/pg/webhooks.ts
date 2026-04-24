import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgBinary, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, URL_MAX_LENGTH } from "../../helpers/db.constants.js";
import { WEBHOOK_DELIVERY_STATUSES, WEBHOOK_EVENT_TYPES } from "../../helpers/enums.js";

import { apiKeys } from "./api-keys.js";
import { systems } from "./systems.js";

import type {
  ApiKeyId,
  ServerSecret,
  SystemId,
  WebhookDeliveryId,
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const webhookConfigs = pgTable(
  "webhook_configs",
  {
    id: brandedId<WebhookId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    url: varchar("url", { length: URL_MAX_LENGTH }).notNull(),
    /** T3 (server-readable): raw HMAC signing key the server uses to sign outbound webhook payloads. Intentionally not E2E encrypted — server must read it to produce signatures at delivery time. */
    secret: pgBinary("secret").notNull().$type<ServerSecret>(),
    eventTypes: jsonb("event_types").notNull().$type<readonly WebhookEventType[]>(),
    enabled: boolean("enabled").notNull().default(true),
    cryptoKeyId: brandedId<ApiKeyId>("crypto_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("webhook_configs_system_archived_idx").on(t.systemId, t.archived),
    unique("webhook_configs_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("webhook_configs", t.version),
    archivableConsistencyCheckFor("webhook_configs", t.archived, t.archivedAt),
  ],
);

/**
 * Webhook delivery records. Terminal states ('success', 'failed') should be
 * cleaned up after 30 days. The `webhook_deliveries_terminal_created_at_idx`
 * partial index supports cleanup queries like:
 *   DELETE FROM webhook_deliveries
 *   WHERE status IN ('success', 'failed') AND created_at < $cutoff
 * Actual cleanup job is blocked by infra-m2t5 (background job infrastructure).
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: brandedId<WebhookDeliveryId>("id").primaryKey(),
    webhookId: brandedId<WebhookId>("webhook_id").notNull(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<WebhookEventType>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<WebhookDeliveryStatus>(),
    httpStatus: integer("http_status"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: pgTimestamp("last_attempt_at"),
    nextRetryAt: pgTimestamp("next_retry_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
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
    index("webhook_deliveries_pending_retry_idx")
      .on(t.nextRetryAt)
      .where(sql`${t.status} = 'pending'`),
    foreignKey({
      columns: [t.webhookId, t.systemId],
      foreignColumns: [webhookConfigs.id, webhookConfigs.systemId],
    }).onDelete("restrict"),
    check("webhook_deliveries_event_type_check", enumCheck(t.eventType, WEBHOOK_EVENT_TYPES)),
    check("webhook_deliveries_status_check", enumCheck(t.status, WEBHOOK_DELIVERY_STATUSES)),
    check("webhook_deliveries_attempt_count_check", sql`${t.attemptCount} >= 0`),
    check(
      "webhook_deliveries_http_status_check",
      sql`${t.httpStatus} IS NULL OR (${t.httpStatus} >= 100 AND ${t.httpStatus} <= 599)`,
    ),
  ],
);

export type WebhookConfigRow = InferSelectModel<typeof webhookConfigs>;
export type NewWebhookConfig = InferInsertModel<typeof webhookConfigs>;
export type WebhookDeliveryRow = InferSelectModel<typeof webhookDeliveries>;
export type NewWebhookDelivery = InferInsertModel<typeof webhookDeliveries>;
