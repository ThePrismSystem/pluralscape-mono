import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck, enumCheck, versionCheck } from "../../helpers/check.js";
import { FRONTING_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerFrontingSession } from "@pluralscape/types";

export const frontingSessions = pgTable(
  "fronting_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: pgTimestamp("start_time").notNull(),
    endTime: pgTimestamp("end_time"),
    memberId: varchar("member_id", { length: 255 }),
    frontingType: varchar("fronting_type", { length: 255 }).$type<
      ServerFrontingSession["frontingType"]
    >(),
    customFrontId: varchar("custom_front_id", { length: 255 }),
    linkedStructure: jsonb("linked_structure").$type<ServerFrontingSession["linkedStructure"]>(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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
    check("fronting_sessions_fronting_type_check", enumCheck(t.frontingType, FRONTING_TYPES)),
    unique("fronting_sessions_id_system_id_unique").on(t.id, t.systemId),
    check("fronting_sessions_version_check", versionCheck(t.version)),
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
    memberIds: jsonb("member_ids").notNull().$type<readonly [string, ...string[]]>(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("switches_system_timestamp_idx").on(t.systemId, t.timestamp),
    check("switches_member_ids_check", sql`jsonb_array_length(${t.memberIds}) >= 1`),
  ],
);

export const customFronts = pgTable(
  "custom_fronts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("custom_fronts_system_id_idx").on(t.systemId),
    check("custom_fronts_version_check", versionCheck(t.version)),
    check(
      "custom_fronts_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const frontingComments = pgTable(
  "fronting_comments",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    frontingSessionId: varchar("fronting_session_id", { length: 255 }).notNull(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: 255 }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("fronting_comments_session_created_idx").on(t.frontingSessionId, t.createdAt),
    foreignKey({
      columns: [t.frontingSessionId, t.systemId],
      foreignColumns: [frontingSessions.id, frontingSessions.systemId],
    }).onDelete("cascade"),
    check("fronting_comments_version_check", versionCheck(t.version)),
  ],
);
