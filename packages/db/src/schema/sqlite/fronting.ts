import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, unique } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { atLeastOneNotNull } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";

import { members } from "./members.js";
import { systemStructureEntities } from "./structure.js";

import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const customFronts = sqliteTable(
  "custom_fronts",
  {
    ...entityIdentity<CustomFrontId>(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("custom_fronts_system_archived_idx").on(t.systemId, t.archived),
    unique("custom_fronts_id_system_id_unique").on(t.id, t.systemId),
    ...serverEntityChecks("custom_fronts", t),
  ],
);

// SQLite uses a simple PK (id). The PG schema uses composite PK (id, start_time) for
// PARTITION BY RANGE — see schema/pg/fronting.ts. No partitioning in SQLite.
export const frontingSessions = sqliteTable(
  "fronting_sessions",
  {
    ...entityIdentity<FrontingSessionId>(),
    startTime: sqliteTimestamp("start_time").notNull(),
    endTime: sqliteTimestamp("end_time"),
    memberId: brandedId<MemberId>("member_id"),
    customFrontId: brandedId<CustomFrontId>("custom_front_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    ...encryptedPayload(),
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
    ...serverEntityChecks("fronting_sessions", t),
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
    ...entityIdentity<FrontingCommentId>(),
    frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id").notNull(),
    memberId: brandedId<MemberId>("member_id"),
    customFrontId: brandedId<CustomFrontId>("custom_front_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    ...encryptedPayload(),
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
    ...serverEntityChecks("fronting_comments", t),
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
