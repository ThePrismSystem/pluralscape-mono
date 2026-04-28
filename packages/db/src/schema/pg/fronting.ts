import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, unique } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { atLeastOneNotNull } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";

import { members } from "./members.js";
import { systemStructureEntities } from "./structure.js";
import { systems } from "./systems.js";

import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  ServerInternal,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const customFronts = pgTable(
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

// Carve-out: composite PK (id, start_time) for PARTITION BY RANGE (start_time);
// `id` is notNull rather than primaryKey, so entityIdentity does not fit. The
// production migration adds the partitioning clause manually — see migration
// 0013.
export const frontingSessions = pgTable(
  "fronting_sessions",
  {
    id: brandedId<FrontingSessionId>("id").notNull(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    startTime: pgTimestamp("start_time").notNull(),
    endTime: pgTimestamp("end_time"),
    memberId: brandedId<MemberId>("member_id"),
    customFrontId: brandedId<CustomFrontId>("custom_front_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
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

export const frontingComments = pgTable(
  "fronting_comments",
  {
    ...entityIdentity<FrontingCommentId>(),
    frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id").notNull(),
    /**
     * Denormalized from parent fronting session for FK on partitioned table
     * (ADR 019). Branded `ServerInternal<UnixMillis>` to keep the field
     * server-only — `EncryptedWire<T>` strips it from the wire envelope.
     */
    sessionStartTime: pgTimestamp("session_start_time")
      .$type<ServerInternal<UnixMillis>>()
      .notNull(),
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
