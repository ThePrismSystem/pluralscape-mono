import { boolean, check, index, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { timestamps } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { DEVICE_TOKEN_PLATFORMS, NOTIFICATION_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { friendConnections } from "./privacy.js";
import { systems } from "./systems.js";

import type { DeviceTokenPlatform, NotificationEventType } from "@pluralscape/types";

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 255 }).notNull().$type<DeviceTokenPlatform>(),
    token: varchar("token", { length: 255 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    lastUsedAt: pgTimestamp("last_used_at"),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
    check("device_tokens_platform_check", enumCheck(t.platform, DEVICE_TOKEN_PLATFORMS)),
  ],
);

export const notificationConfigs = pgTable(
  "notification_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 255 }).notNull().$type<NotificationEventType>(),
    enabled: boolean("enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("notification_configs_system_id_event_type_idx").on(t.systemId, t.eventType),
    check(
      "notification_configs_event_type_check",
      enumCheck(t.eventType, NOTIFICATION_EVENT_TYPES),
    ),
  ],
);

export const friendNotificationPreferences = pgTable(
  "friend_notification_preferences",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendConnectionId: varchar("friend_connection_id", { length: 255 })
      .notNull()
      .references(() => friendConnections.id, { onDelete: "cascade" }),
    enabledEventTypes: jsonb("enabled_event_types").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("friend_notification_prefs_system_id_friend_connection_id_idx").on(
      t.systemId,
      t.friendConnectionId,
    ),
  ],
);
