import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { FRONTING_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerFrontingSession } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
  (t) => [
    index("custom_fronts_system_archived_idx").on(t.systemId, t.archived),
    versionCheckFor("custom_fronts", t.version),
    archivableConsistencyCheckFor("custom_fronts", t.archived, t.archivedAt),
  ],
);

// SQLite uses a simple PK (id). The PG schema uses composite PK (id, start_time) for
// PARTITION BY RANGE — see schema/pg/fronting.ts. No partitioning in SQLite.
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
    frontingType: text("fronting_type")
      .notNull()
      .default("fronting")
      .$type<ServerFrontingSession["frontingType"]>(),
    customFrontId: text("custom_front_id"),
    linkedStructure:
      sqliteJson("linked_structure").$type<ServerFrontingSession["linkedStructure"]>(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("fronting_sessions_system_start_idx").on(t.systemId, t.startTime),
    index("fronting_sessions_system_member_start_idx").on(t.systemId, t.memberId, t.startTime),
    index("fronting_sessions_system_end_idx").on(t.systemId, t.endTime),
    index("fronting_sessions_system_type_start_idx").on(t.systemId, t.frontingType, t.startTime),
    index("fronting_sessions_active_idx")
      .on(t.systemId)
      .where(sql`${t.endTime} IS NULL`),
    index("fronting_sessions_system_archived_idx").on(t.systemId, t.archived),
    check(
      "fronting_sessions_end_time_check",
      sql`${t.endTime} IS NULL OR ${t.endTime} > ${t.startTime}`,
    ),
    check("fronting_sessions_fronting_type_check", enumCheck(t.frontingType, FRONTING_TYPES)),
    unique("fronting_sessions_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.customFrontId],
      foreignColumns: [customFronts.id],
    }).onDelete("set null"),
    versionCheckFor("fronting_sessions", t.version),
    archivableConsistencyCheckFor("fronting_sessions", t.archived, t.archivedAt),
    // Invariant: every session must have at least one subject (member or custom front).
    // Both member_id and custom_front_id use ON DELETE SET NULL — if the sole subject is
    // hard-deleted, the cascade will violate this CHECK. This is intentional fail-loud
    // behavior: members/custom_fronts should be archived (not deleted) per project
    // principles. Account purge cascades via system_id ON DELETE CASCADE, bypassing this.
    check(
      "fronting_sessions_subject_check",
      sql`${t.memberId} IS NOT NULL OR ${t.customFrontId} IS NOT NULL`,
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
    /**
     * T3 plaintext: member IDs are opaque tokens (see tier map at encryption.ts:626).
     * Known limitation: JSON arrays cannot have FK constraints — cross-system
     * member ID validation is enforced at the application layer.
     */
    memberIds: sqliteJson("member_ids").notNull().$type<readonly [string, ...string[]]>(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("switches_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("switches_system_archived_idx").on(t.systemId, t.archived),
    check("switches_member_ids_check", sql`json_array_length(${t.memberIds}) >= 1`),
    versionCheckFor("switches", t.version),
    archivableConsistencyCheckFor("switches", t.archived, t.archivedAt),
  ],
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
    ...archivable(),
  },
  (t) => [
    index("fronting_comments_session_created_idx").on(t.frontingSessionId, t.createdAt),
    index("fronting_comments_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.frontingSessionId, t.systemId],
      foreignColumns: [frontingSessions.id, frontingSessions.systemId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("set null"),
    versionCheckFor("fronting_comments", t.version),
    archivableConsistencyCheckFor("fronting_comments", t.archived, t.archivedAt),
  ],
);

export type FrontingSessionRow = InferSelectModel<typeof frontingSessions>;
export type NewFrontingSession = InferInsertModel<typeof frontingSessions>;
export type SwitchRow = InferSelectModel<typeof switches>;
export type NewSwitch = InferInsertModel<typeof switches>;
export type CustomFrontRow = InferSelectModel<typeof customFronts>;
export type NewCustomFront = InferInsertModel<typeof customFronts>;
export type FrontingCommentRow = InferSelectModel<typeof frontingComments>;
export type NewFrontingComment = InferInsertModel<typeof frontingComments>;
