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
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { versionCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

export const timerConfigs = pgTable(
  "timer_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
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
  },
  (t) => [
    index("timer_configs_system_id_idx").on(t.systemId),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    check("timer_configs_version_check", versionCheck(t.version)),
  ],
);

export const checkInRecords = pgTable(
  "check_in_records",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: varchar("timer_config_id", { length: 255 }).notNull(),
    scheduledAt: pgTimestamp("scheduled_at").notNull(),
    respondedAt: pgTimestamp("responded_at"),
    dismissed: boolean("dismissed").notNull().default(false),
    respondedByMemberId: varchar("responded_by_member_id", { length: 255 }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
  },
  (t) => [
    index("check_in_records_system_id_idx").on(t.systemId),
    index("check_in_records_timer_config_id_idx").on(t.timerConfigId),
    index("check_in_records_scheduled_at_idx").on(t.scheduledAt),
    foreignKey({
      columns: [t.timerConfigId, t.systemId],
      foreignColumns: [timerConfigs.id, timerConfigs.systemId],
    }).onDelete("cascade"),
  ],
);
