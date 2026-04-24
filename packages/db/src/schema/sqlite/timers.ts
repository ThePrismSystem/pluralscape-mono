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

import { brandedId, sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { sqliteTimeFormatCheck } from "../../helpers/check.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { MemberId, SystemId, TimerId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const timerConfigs = sqliteTable(
  "timer_configs",
  {
    id: brandedId<TimerId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    intervalMinutes: integer("interval_minutes"),
    wakingHoursOnly: integer("waking_hours_only", { mode: "boolean" }),
    wakingStart: text("waking_start"),
    wakingEnd: text("waking_end"),
    nextCheckInAt: sqliteTimestamp("next_check_in_at"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("timer_configs_system_archived_idx").on(t.systemId, t.archived),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("timer_configs", t.version),
    check("timer_configs_waking_start_format", sqliteTimeFormatCheck(t.wakingStart)),
    check("timer_configs_waking_end_format", sqliteTimeFormatCheck(t.wakingEnd)),
    archivableConsistencyCheckFor("timer_configs", t.archived, t.archivedAt),
    index("timer_configs_next_check_in_idx")
      .on(t.nextCheckInAt)
      .where(sql`${t.enabled} = 1 AND ${t.archivedAt} IS NULL`),
    index("timer_configs_enabled_active_idx")
      .on(t.enabled)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

// CheckInRecord is a Cluster 6 entity; its own `id` brand lift lives with
// that cluster. The FK columns pointing at timer-config and member are lifted
// here because they reference this cluster's and Cluster 1's tables.
export const checkInRecords = sqliteTable(
  "check_in_records",
  {
    id: text("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: brandedId<TimerId>("timer_config_id").notNull(),
    scheduledAt: sqliteTimestamp("scheduled_at").notNull(),
    respondedAt: sqliteTimestamp("responded_at"),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    respondedByMemberId: brandedId<MemberId>("responded_by_member_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    idempotencyKey: text("idempotency_key"),
    ...archivable(),
  },
  (t) => [
    index("check_in_records_system_id_idx").on(t.systemId),
    index("check_in_records_timer_config_id_idx").on(t.timerConfigId),
    index("check_in_records_scheduled_at_idx").on(t.scheduledAt),
    unique("check_in_records_idempotency_key_unique").on(t.idempotencyKey),
    foreignKey({
      columns: [t.timerConfigId, t.systemId],
      foreignColumns: [timerConfigs.id, timerConfigs.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.respondedByMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    index("check_in_records_system_pending_idx")
      .on(t.systemId, t.scheduledAt)
      .where(sql`${t.respondedAt} IS NULL AND ${t.dismissed} = 0 AND ${t.archived} = 0`),
    archivableConsistencyCheckFor("check_in_records", t.archived, t.archivedAt),
  ],
);

export type TimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewTimerConfig = InferInsertModel<typeof timerConfigs>;
export type CheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewCheckInRecord = InferInsertModel<typeof checkInRecords>;
