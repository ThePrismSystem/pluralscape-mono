import { sql } from "drizzle-orm";
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

import { brandedId, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
} from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { entityIdentity, serverEntityChecks } from "../../helpers/entity-shape.sqlite.js";
import { DEVICE_TOKEN_PLATFORMS, NOTIFICATION_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { friendConnections } from "./privacy.js";

import type {
  AccountId,
  DeviceTokenId,
  DeviceTokenPlatform,
  FriendConnectionId,
  FriendNotificationEventType,
  FriendNotificationPreferenceId,
  NotificationConfigId,
  NotificationEventType,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: device_tokens has no encrypted payload and bespoke
// createdAt/lastActiveAt/revokedAt timestamps instead of the standard mixin.
export const deviceTokens = sqliteTable(
  "device_tokens",
  {
    ...entityIdentity<DeviceTokenId>(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().$type<DeviceTokenPlatform>(),
    tokenHash: text("token_hash").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastActiveAt: sqliteTimestamp("last_active_at"),
    revokedAt: sqliteTimestamp("revoked_at"),
  },
  (t) => [
    index("device_tokens_account_id_idx").on(t.accountId),
    index("device_tokens_system_id_idx").on(t.systemId),
    index("device_tokens_revoked_at_idx").on(t.revokedAt),
    unique("device_tokens_token_hash_platform_unique").on(t.tokenHash, t.platform),
    check("device_tokens_platform_check", enumCheck(t.platform, DEVICE_TOKEN_PLATFORMS)),
  ],
);

// Carve-out: this table has no encrypted payload (the configuration is plain
// settings, not user content).
export const notificationConfigs = sqliteTable(
  "notification_configs",
  {
    ...entityIdentity<NotificationConfigId>(),
    eventType: text("event_type").notNull().$type<NotificationEventType>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    uniqueIndex("notification_configs_system_id_event_type_idx")
      .on(t.systemId, t.eventType)
      .where(sql`${t.archived} = 0`),
    check(
      "notification_configs_event_type_check",
      enumCheck(t.eventType, NOTIFICATION_EVENT_TYPES),
    ),
    ...serverEntityChecks("notification_configs", t),
  ],
);

// Account-scoped (not system-scoped) — entityIdentity does not fit.
export const friendNotificationPreferences = sqliteTable(
  "friend_notification_preferences",
  {
    id: brandedId<FriendNotificationPreferenceId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    friendConnectionId: brandedId<FriendConnectionId>("friend_connection_id").notNull(),
    enabledEventTypes: sqliteJson("enabled_event_types")
      .notNull()
      .$type<readonly FriendNotificationEventType[]>(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    uniqueIndex("friend_notification_prefs_account_id_friend_connection_id_idx")
      .on(t.accountId, t.friendConnectionId)
      .where(sql`${t.archived} = 0`),
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
