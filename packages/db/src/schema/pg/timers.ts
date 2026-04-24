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

import { brandedId, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
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

import type { MemberId, SystemId, TimerId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const timerConfigs = pgTable(
  "timer_configs",
  {
    id: brandedId<TimerId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    intervalMinutes: integer("interval_minutes"),
    wakingHoursOnly: boolean("waking_hours_only"),
    wakingStart: varchar("waking_start", { length: 255 }),
    wakingEnd: varchar("waking_end", { length: 255 }),
    nextCheckInAt: pgTimestamp("next_check_in_at"),
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
    index("timer_configs_next_check_in_idx")
      .on(t.nextCheckInAt)
      .where(sql`${t.enabled} = true AND ${t.archivedAt} IS NULL`),
    index("timer_configs_enabled_active_idx")
      .on(t.enabled)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

// CheckInRecord is a Cluster 6 entity; its own `id` brand lift lives with
// that cluster. The FK columns pointing at timer-config and member are lifted
// here because they reference this cluster's and Cluster 1's tables.
export const checkInRecords = pgTable(
  "check_in_records",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: brandedId<TimerId>("timer_config_id").notNull(),
    scheduledAt: pgTimestamp("scheduled_at").notNull(),
    respondedAt: pgTimestamp("responded_at"),
    dismissed: boolean("dismissed").notNull().default(false),
    respondedByMemberId: brandedId<MemberId>("responded_by_member_id"),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
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
      .where(sql`${t.respondedAt} IS NULL AND ${t.dismissed} = false AND ${t.archived} = false`),
    archivableConsistencyCheckFor("check_in_records", t.archived, t.archivedAt),
  ],
);

export type TimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewTimerConfig = InferInsertModel<typeof timerConfigs>;
export type CheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewCheckInRecord = InferInsertModel<typeof checkInRecords>;
