import { sql } from "drizzle-orm";
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

import { brandedId, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
import { DEVICE_TOKEN_PLATFORMS, NOTIFICATION_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { friendConnections } from "./privacy.js";
import { systems } from "./systems.js";

import type {
  AccountId,
  DeviceTokenPlatform,
  FriendConnectionId,
  FriendNotificationEventType,
  FriendNotificationPreferenceId,
  NotificationConfigId,
  NotificationEventType,
  SystemId,
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
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    lastActiveAt: pgTimestamp("last_active_at"),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
    unique("device_tokens_token_hash_platform_unique").on(t.tokenHash, t.platform),
    check("device_tokens_platform_check", enumCheck(t.platform, DEVICE_TOKEN_PLATFORMS)),
  ],
);

export const notificationConfigs = pgTable(
  "notification_configs",
  {
    id: brandedId<NotificationConfigId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<NotificationEventType>(),
    enabled: boolean("enabled").notNull().default(false),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    uniqueIndex("notification_configs_system_id_event_type_idx")
      .on(t.systemId, t.eventType)
      .where(sql`${t.archived} = false`),
    check(
      "notification_configs_event_type_check",
      enumCheck(t.eventType, NOTIFICATION_EVENT_TYPES),
    ),
    archivableConsistencyCheckFor("notification_configs", t.archived, t.archivedAt),
    versionCheckFor("notification_configs", t.version),
  ],
);

export const friendNotificationPreferences = pgTable(
  "friend_notification_preferences",
  {
    id: brandedId<FriendNotificationPreferenceId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    friendConnectionId: brandedId<FriendConnectionId>("friend_connection_id").notNull(),
    enabledEventTypes: jsonb("enabled_event_types")
      .notNull()
      .$type<readonly FriendNotificationEventType[]>(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    uniqueIndex("friend_notification_prefs_account_id_friend_connection_id_idx")
      .on(t.accountId, t.friendConnectionId)
      .where(sql`${t.archived} = false`),
    foreignKey({
      columns: [t.friendConnectionId, t.accountId],
      foreignColumns: [friendConnections.id, friendConnections.accountId],
    }).onDelete("restrict"),
    archivableConsistencyCheckFor("friend_notification_preferences", t.archived, t.archivedAt),
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
