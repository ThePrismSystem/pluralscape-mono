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
} from "../../helpers/audit.pg.js";
import { pgTimeFormatCheck } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";

import { members } from "./members.js";

import type { CheckInRecordId, MemberId, ServerInternal, TimerId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const timerConfigs = pgTable(
  "timer_configs",
  {
    ...entityIdentity<TimerId>(),
    enabled: boolean("enabled").notNull().default(true),
    intervalMinutes: integer("interval_minutes"),
    wakingHoursOnly: boolean("waking_hours_only"),
    wakingStart: varchar("waking_start", { length: 255 }),
    wakingEnd: varchar("waking_end", { length: 255 }),
    nextCheckInAt: pgTimestamp("next_check_in_at"),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("timer_configs_system_archived_idx").on(t.systemId, t.archived),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    check("timer_configs_waking_start_format", pgTimeFormatCheck(t.wakingStart)),
    check("timer_configs_waking_end_format", pgTimeFormatCheck(t.wakingEnd)),
    ...serverEntityChecks("timer_configs", t),
    index("timer_configs_next_check_in_idx")
      .on(t.nextCheckInAt)
      .where(sql`${t.enabled} = true AND ${t.archivedAt} IS NULL`),
    index("timer_configs_enabled_active_idx")
      .on(t.enabled)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

// Carve-out: nullable encryptedData (response payload optional until captured)
// and no timestamps()/versioned() — entityIdentity applies.
export const checkInRecords = pgTable(
  "check_in_records",
  {
    ...entityIdentity<CheckInRecordId>(),
    timerConfigId: brandedId<TimerId>("timer_config_id").notNull(),
    scheduledAt: pgTimestamp("scheduled_at").notNull(),
    respondedAt: pgTimestamp("responded_at"),
    dismissed: boolean("dismissed").notNull().default(false),
    respondedByMemberId: brandedId<MemberId>("responded_by_member_id"),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    /**
     * Server-generated dedup key for webhook-driven response writes.
     * Branded `ServerInternal<…>` so `EncryptedWire<T>` strips it from
     * the wire envelope (never leaked to clients).
     */
    idempotencyKey: varchar("idempotency_key", { length: 255 }).$type<ServerInternal<string>>(),
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
