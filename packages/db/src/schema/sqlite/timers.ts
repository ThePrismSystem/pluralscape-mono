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

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck, sqliteTimeFormatCheck } from "../../helpers/check.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const timerConfigs = sqliteTable(
  "timer_configs",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    intervalMinutes: integer("interval_minutes"),
    wakingHoursOnly: integer("waking_hours_only", { mode: "boolean" }),
    wakingStart: text("waking_start"),
    wakingEnd: text("waking_end"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("timer_configs_system_id_idx").on(t.systemId),
    index("timer_configs_system_id_archived_idx").on(t.systemId, t.archived),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("timer_configs", t.version),
    check("timer_configs_waking_start_format", sqliteTimeFormatCheck(t.wakingStart)),
    check("timer_configs_waking_end_format", sqliteTimeFormatCheck(t.wakingEnd)),
    check(
      "timer_configs_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const checkInRecords = sqliteTable(
  "check_in_records",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: text("timer_config_id").notNull(),
    scheduledAt: sqliteTimestamp("scheduled_at").notNull(),
    respondedAt: sqliteTimestamp("responded_at"),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    respondedByMemberId: text("responded_by_member_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    ...archivable(),
  },
  (t) => [
    index("check_in_records_system_id_idx").on(t.systemId),
    index("check_in_records_timer_config_id_idx").on(t.timerConfigId),
    index("check_in_records_scheduled_at_idx").on(t.scheduledAt),
    foreignKey({
      columns: [t.timerConfigId, t.systemId],
      foreignColumns: [timerConfigs.id, timerConfigs.systemId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.respondedByMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("set null"),
    index("check_in_records_system_pending_idx")
      .on(t.systemId, t.scheduledAt)
      .where(sql`${t.respondedAt} IS NULL AND ${t.dismissed} = 0`),
    check(
      "check_in_records_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export type TimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewTimerConfig = InferInsertModel<typeof timerConfigs>;
export type CheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewCheckInRecord = InferInsertModel<typeof checkInRecords>;
