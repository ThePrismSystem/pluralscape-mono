import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { pgTimeFormatCheck } from "../../helpers/check.js";
import { ID_MAX_LENGTH } from "../../helpers/db.constants.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const timerConfigs = pgTable(
  "timer_configs",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    intervalMinutes: integer("interval_minutes"),
    wakingHoursOnly: boolean("waking_hours_only"),
    wakingStart: varchar("waking_start", { length: 255 }),
    wakingEnd: varchar("waking_end", { length: 255 }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("timer_configs_system_archived_idx").on(t.systemId, t.archived),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("timer_configs", t.version),
    check("timer_configs_waking_start_format", pgTimeFormatCheck(t.wakingStart)),
    check("timer_configs_waking_end_format", pgTimeFormatCheck(t.wakingEnd)),
    archivableConsistencyCheckFor("timer_configs", t.archived, t.archivedAt),
  ],
);

export const checkInRecords = pgTable(
  "check_in_records",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: varchar("timer_config_id", { length: ID_MAX_LENGTH }).notNull(),
    scheduledAt: pgTimestamp("scheduled_at").notNull(),
    respondedAt: pgTimestamp("responded_at"),
    dismissed: boolean("dismissed").notNull().default(false),
    respondedByMemberId: varchar("responded_by_member_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
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
      .where(sql`${t.respondedAt} IS NULL AND ${t.dismissed} = false AND ${t.archived} = false`),
    archivableConsistencyCheckFor("check_in_records", t.archived, t.archivedAt),
  ],
);

export type TimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewTimerConfig = InferInsertModel<typeof timerConfigs>;
export type CheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewCheckInRecord = InferInsertModel<typeof checkInRecords>;
