import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerFrontingSession } from "@pluralscape/types";

export const frontingSessions = sqliteTable(
  "fronting_sessions",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: sqliteTimestamp("start_time").notNull(),
    endTime: sqliteTimestamp("end_time"),
    memberId: text("member_id"),
    frontingType: text("fronting_type").$type<ServerFrontingSession["frontingType"]>(),
    customFrontId: text("custom_front_id"),
    linkedStructure:
      sqliteJson("linked_structure").$type<ServerFrontingSession["linkedStructure"]>(),
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
    unique("fronting_sessions_id_system_id_unique").on(t.id, t.systemId),
    check("fronting_sessions_fronting_type_check", enumCheck(t.frontingType, FRONTING_TYPES)),
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
    memberIds: sqliteJson("member_ids").notNull().$type<readonly [string, ...string[]]>(),
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
    frontingSessionId: text("fronting_session_id").notNull(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: text("member_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("fronting_comments_session_created_idx").on(t.frontingSessionId, t.createdAt),
    foreignKey({
      columns: [t.frontingSessionId, t.systemId],
      foreignColumns: [frontingSessions.id, frontingSessions.systemId],
    }).onDelete("cascade"),
  ],
);
