import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps } from "../../helpers/audit.sqlite.js";

import { accounts } from "./auth.js";
import { friendConnections } from "./privacy.js";
import { systems } from "./systems.js";

import type { DeviceTokenPlatform, NotificationEventType } from "@pluralscape/types";

export const deviceTokens = sqliteTable(
  "device_tokens",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().$type<DeviceTokenPlatform>(),
    token: text("token").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastUsedAt: sqliteTimestamp("last_used_at"),
    revokedAt: sqliteTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
  ],
);

export const notificationConfigs = sqliteTable(
  "notification_configs",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().$type<NotificationEventType>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("notification_configs_system_id_event_type_idx").on(t.systemId, t.eventType)],
);

export const friendNotificationPreferences = sqliteTable(
  "friend_notification_preferences",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendConnectionId: text("friend_connection_id")
      .notNull()
      .references(() => friendConnections.id, { onDelete: "cascade" }),
    enabledEventTypes: sqliteJson("enabled_event_types").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("friend_notification_prefs_system_id_friend_connection_id_idx").on(
      t.systemId,
      t.friendConnectionId,
    ),
  ],
);
