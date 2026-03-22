import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { atLeastOneNotNull } from "../../helpers/check.js";

import { members } from "./members.js";
import { systemStructureEntities } from "./structure.js";
import { systems } from "./systems.js";

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
    unique("custom_fronts_id_system_id_unique").on(t.id, t.systemId),
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
    customFrontId: text("custom_front_id"),
    structureEntityId: text("structure_entity_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
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
    unique("fronting_sessions_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
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
      atLeastOneNotNull(t.memberId, t.customFrontId, t.structureEntityId),
    ),
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
    customFrontId: text("custom_front_id"),
    structureEntityId: text("structure_entity_id"),
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
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.customFrontId],
      foreignColumns: [customFronts.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.structureEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    versionCheckFor("fronting_comments", t.version),
    archivableConsistencyCheckFor("fronting_comments", t.archived, t.archivedAt),
    // Invariant: every comment must have at least one author (member, custom front, or structure entity).
    check(
      "fronting_comments_author_check",
      atLeastOneNotNull(t.memberId, t.customFrontId, t.structureEntityId),
    ),
  ],
);

export type FrontingSessionRow = InferSelectModel<typeof frontingSessions>;
export type NewFrontingSession = InferInsertModel<typeof frontingSessions>;
export type CustomFrontRow = InferSelectModel<typeof customFronts>;
export type NewCustomFront = InferInsertModel<typeof customFronts>;
export type FrontingCommentRow = InferSelectModel<typeof frontingComments>;
export type NewFrontingComment = InferInsertModel<typeof frontingComments>;
