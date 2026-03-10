import { sql } from "drizzle-orm";
import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const frontingSessions = pgTable(
  "fronting_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: pgTimestamp("start_time").notNull(),
    endTime: pgTimestamp("end_time"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("fronting_sessions_system_start_idx").on(t.systemId, t.startTime),
    index("fronting_sessions_system_end_idx").on(t.systemId, t.endTime),
    check(
      "fronting_sessions_end_time_check",
      sql`${t.endTime} IS NULL OR ${t.endTime} > ${t.startTime}`,
    ),
  ],
);

export const switches = pgTable(
  "switches",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timestamp: pgTimestamp("timestamp").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [index("switches_system_timestamp_idx").on(t.systemId, t.timestamp)],
);

export const customFronts = pgTable(
  "custom_fronts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [index("custom_fronts_system_id_idx").on(t.systemId)],
);

export const frontingComments = pgTable(
  "fronting_comments",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 })
      .notNull()
      .references(() => frontingSessions.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("fronting_comments_session_created_idx").on(t.sessionId, t.createdAt)],
);
