import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck, enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { FRONTING_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerFrontingSession } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const customFronts = pgTable(
  "custom_fronts",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("custom_fronts_system_id_idx").on(t.systemId),
    versionCheckFor("custom_fronts", t.version),
    check(
      "custom_fronts_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const frontingSessions = pgTable(
  "fronting_sessions",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: pgTimestamp("start_time").notNull(),
    endTime: pgTimestamp("end_time"),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }),
    frontingType: varchar("fronting_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("fronting")
      .$type<ServerFrontingSession["frontingType"]>(),
    customFrontId: varchar("custom_front_id", { length: ID_MAX_LENGTH }),
    linkedStructure: jsonb("linked_structure").$type<ServerFrontingSession["linkedStructure"]>(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("fronting_sessions_system_start_idx").on(t.systemId, t.startTime),
    index("fronting_sessions_system_member_start_idx").on(t.systemId, t.memberId, t.startTime),
    index("fronting_sessions_system_end_idx").on(t.systemId, t.endTime),
    index("fronting_sessions_active_idx")
      .on(t.systemId)
      .where(sql`${t.endTime} IS NULL`),
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

// Switches are immutable timeline events and are not archivable.
export const switches = pgTable(
  "switches",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timestamp: pgTimestamp("timestamp").notNull(),
    /**
     * T3 plaintext: member IDs are opaque tokens (see tier map at encryption.ts:626).
     * Known limitation: JSONB arrays cannot have FK constraints — cross-system
     * member ID validation is enforced at the application layer.
     */
    memberIds: jsonb("member_ids").notNull().$type<readonly [string, ...string[]]>(),
    createdAt: pgTimestamp("created_at").notNull(),
    ...versioned(),
  },
  (t) => [
    index("switches_system_timestamp_idx").on(t.systemId, t.timestamp),
    check("switches_member_ids_check", sql`jsonb_array_length(${t.memberIds}) >= 1`),
    versionCheckFor("switches", t.version),
  ],
);

export const frontingComments = pgTable(
  "fronting_comments",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    frontingSessionId: varchar("fronting_session_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }),
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
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("set null"),
    versionCheckFor("fronting_comments", t.version),
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
