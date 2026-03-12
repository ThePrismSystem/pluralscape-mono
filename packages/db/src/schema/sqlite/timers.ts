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
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { versionCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

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
  },
  (t) => [
    index("timer_configs_system_id_idx").on(t.systemId),
    unique("timer_configs_id_system_id_unique").on(t.id, t.systemId),
    check("timer_configs_version_check", versionCheck(t.version)),
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
