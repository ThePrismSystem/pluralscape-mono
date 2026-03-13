import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { DEVICE_TOKEN_PLATFORMS, NOTIFICATION_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { friendConnections } from "./privacy.js";
import { systems } from "./systems.js";

import type {
  DeviceTokenPlatform,
  FriendNotificationEventType,
  NotificationEventType,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
    lastActiveAt: sqliteTimestamp("last_active_at"),
    revokedAt: sqliteTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
    unique("device_tokens_token_platform_unique").on(t.token, t.platform),
    check("device_tokens_platform_check", enumCheck(t.platform, DEVICE_TOKEN_PLATFORMS)),
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
  (t) => [
    uniqueIndex("notification_configs_system_id_event_type_idx").on(t.systemId, t.eventType),
    check(
      "notification_configs_event_type_check",
      enumCheck(t.eventType, NOTIFICATION_EVENT_TYPES),
    ),
  ],
);

export const friendNotificationPreferences = sqliteTable(
  "friend_notification_preferences",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendConnectionId: text("friend_connection_id").notNull(),
    enabledEventTypes: sqliteJson("enabled_event_types")
      .notNull()
      .$type<readonly FriendNotificationEventType[]>(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("friend_notification_prefs_system_id_friend_connection_id_idx").on(
      t.systemId,
      t.friendConnectionId,
    ),
    foreignKey({
      columns: [t.friendConnectionId, t.systemId],
      foreignColumns: [friendConnections.id, friendConnections.accountId],
    }).onDelete("cascade"),
  ],
);

export type DeviceTokenRow = InferSelectModel<typeof deviceTokens>;
export type NewDeviceToken = InferInsertModel<typeof deviceTokens>;
export type NotificationConfigRow = InferSelectModel<typeof notificationConfigs>;
export type NewNotificationConfig = InferInsertModel<typeof notificationConfigs>;
export type FriendNotificationPreferenceRow = InferSelectModel<
  typeof friendNotificationPreferences
>;
export type NewFriendNotificationPreference = InferInsertModel<
  typeof friendNotificationPreferences
>;
