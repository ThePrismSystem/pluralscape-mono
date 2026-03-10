import { boolean, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const timerConfigs = pgTable(
  "timer_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("timer_configs_system_id_idx").on(t.systemId)],
);

export const checkInRecords = pgTable(
  "check_in_records",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timerConfigId: varchar("timer_config_id", { length: 255 })
      .notNull()
      .references(() => timerConfigs.id, { onDelete: "cascade" }),
    scheduledAt: pgTimestamp("scheduled_at").notNull(),
    respondedAt: pgTimestamp("responded_at"),
    dismissed: boolean("dismissed").notNull().default(false),
    encryptedData: pgBinary("encrypted_data"),
  },
  (t) => [
    index("check_in_records_system_id_idx").on(t.systemId),
    index("check_in_records_timer_config_id_idx").on(t.timerConfigId),
    index("check_in_records_scheduled_at_idx").on(t.scheduledAt),
  ],
);
