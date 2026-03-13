import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { timestamps } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
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

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<DeviceTokenPlatform>(),
    token: varchar("token", { length: 512 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    lastActiveAt: pgTimestamp("last_active_at"),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
    unique("device_tokens_token_platform_unique").on(t.token, t.platform),
    check("device_tokens_platform_check", enumCheck(t.platform, DEVICE_TOKEN_PLATFORMS)),
  ],
);

export const notificationConfigs = pgTable(
  "notification_configs",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<NotificationEventType>(),
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
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendConnectionId: varchar("friend_connection_id", { length: ID_MAX_LENGTH }).notNull(),
    enabledEventTypes: jsonb("enabled_event_types")
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
