import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
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
import { ID_MAX_LENGTH } from "../../helpers/db.constants.js";

import { members } from "./members.js";
import { systemStructureEntities } from "./structure.js";
import { systems } from "./systems.js";

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
    customFrontId: varchar("custom_front_id", { length: ID_MAX_LENGTH }),
    structureEntityId: varchar("structure_entity_id", { length: ID_MAX_LENGTH }),
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
    index("fronting_sessions_active_idx")
      .on(t.systemId)
      .where(sql`${t.endTime} IS NULL`),
    index("fronting_sessions_system_archived_idx").on(t.systemId, t.archived),
    check(
      "fronting_sessions_end_time_check",
      sql`${t.endTime} IS NULL OR ${t.endTime} > ${t.startTime}`,
    ),
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
    foreignKey({
      columns: [t.structureEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    index("fronting_sessions_system_entity_start_idx").on(
      t.systemId,
      t.structureEntityId,
      t.startTime,
    ),
    versionCheckFor("fronting_sessions", t.version),
    archivableConsistencyCheckFor("fronting_sessions", t.archived, t.archivedAt),
    // Invariant: every session must have at least one subject (member, custom front, or structure entity).
    // Subject FKs use ON DELETE RESTRICT — fronting sessions referencing a subject must be removed
    // before that subject can be deleted. Account purge cascades via system_id ON DELETE CASCADE, bypassing this.
    check(
      "fronting_sessions_subject_check",
      sql`${t.memberId} IS NOT NULL OR ${t.customFrontId} IS NOT NULL OR ${t.structureEntityId} IS NOT NULL`,
    ),
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
export type CustomFrontRow = InferSelectModel<typeof customFronts>;
export type NewCustomFront = InferInsertModel<typeof customFronts>;
export type FrontingCommentRow = InferSelectModel<typeof frontingComments>;
export type NewFrontingComment = InferInsertModel<typeof frontingComments>;
