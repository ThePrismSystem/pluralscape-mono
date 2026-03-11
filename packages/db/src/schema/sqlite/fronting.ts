import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

export const frontingSessions = sqliteTable(
  "fronting_sessions",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: sqliteTimestamp("start_time").notNull(),
    endTime: sqliteTimestamp("end_time"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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

export const switches = sqliteTable(
  "switches",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timestamp: sqliteTimestamp("timestamp").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [index("switches_system_timestamp_idx").on(t.systemId, t.timestamp)],
);

export const customFronts = sqliteTable(
  "custom_fronts",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [index("custom_fronts_system_id_idx").on(t.systemId)],
);

export const frontingComments = sqliteTable(
  "fronting_comments",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => frontingSessions.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("fronting_comments_session_created_idx").on(t.sessionId, t.createdAt)],
);
