import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
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
    index("custom_fronts_system_archived_idx").on(t.systemId, t.archived),
    unique("custom_fronts_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("custom_fronts", t.version),
    archivableConsistencyCheckFor("custom_fronts", t.archived, t.archivedAt),
  ],
);

// NOTE: The production migration adds PARTITION BY RANGE ("start_time") which Drizzle
// cannot express. Running drizzle-kit generate for this table requires manual verification.
// See migration 0013 for details.
export const frontingSessions = pgTable(
  "fronting_sessions",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).notNull(),
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
    ...archivable(),
  },
  (t) => [
    // Composite PK (id, start_time) required by PARTITION BY RANGE (start_time). This diverges
    // from the SQLite schema (simple PK on id) — see schema/sqlite/fronting.ts for cross-ref.
    primaryKey({ columns: [t.id, t.startTime] }),
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
    unique("fronting_sessions_id_system_id_unique").on(t.id, t.systemId, t.startTime),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    // Single-column FK intentionally: composite (customFrontId, systemId) with ON DELETE SET NULL
    // would attempt to null system_id, violating its NOT NULL constraint. Cross-tenant isolation
    // for custom fronts is enforced by RLS and the system_id FK on this table.
    foreignKey({
      columns: [t.customFrontId],
      foreignColumns: [customFronts.id],
    }).onDelete("restrict"),
    versionCheckFor("fronting_sessions", t.version),
    archivableConsistencyCheckFor("fronting_sessions", t.archived, t.archivedAt),
    // Invariant: every session must have at least one subject (member or custom front).
    // Both member_id and custom_front_id use ON DELETE RESTRICT — members/custom_fronts
    // must be deleted or archived before the fronting session can be removed. Account
    // purge cascades via system_id ON DELETE CASCADE, bypassing this.
    check(
      "fronting_sessions_subject_check",
      sql`${t.memberId} IS NOT NULL OR ${t.customFrontId} IS NOT NULL`,
    ),
  ],
);

// Switches are archivable to support data correction (e.g., mistakenly recorded switches).
// Archived switches are excluded from display but preserved for audit integrity.

// NOTE: The production migration adds PARTITION BY RANGE ("timestamp") which Drizzle
// cannot express. Running drizzle-kit generate for this table requires manual verification.
// See migration 0014 for details.
export const switches = pgTable(
  "switches",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).notNull(),
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
    ...archivable(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.timestamp] }),
    index("switches_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("switches_system_archived_idx").on(t.systemId, t.archived),
    check("switches_member_ids_check", sql`jsonb_array_length(${t.memberIds}) >= 1`),
    versionCheckFor("switches", t.version),
    archivableConsistencyCheckFor("switches", t.archived, t.archivedAt),
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
    /** Denormalized from parent fronting session for FK on partitioned table (ADR 019). */
    sessionStartTime: pgTimestamp("session_start_time").notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("fronting_comments_session_created_idx").on(t.frontingSessionId, t.createdAt),
    index("fronting_comments_session_start_idx").on(t.sessionStartTime),
    index("fronting_comments_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.frontingSessionId, t.systemId, t.sessionStartTime],
      foreignColumns: [frontingSessions.id, frontingSessions.systemId, frontingSessions.startTime],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
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
