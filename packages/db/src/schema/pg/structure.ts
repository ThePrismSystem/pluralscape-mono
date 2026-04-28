import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";
import { RELATIONSHIP_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type {
  MemberId,
  Relationship,
  RelationshipId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const relationships = pgTable(
  "relationships",
  {
    ...entityIdentity<RelationshipId>(),
    sourceMemberId: brandedId<MemberId>("source_member_id"),
    targetMemberId: brandedId<MemberId>("target_member_id"),
    type: varchar("type", { length: ENUM_MAX_LENGTH }).notNull().$type<Relationship["type"]>(),
    bidirectional: boolean("bidirectional").notNull().default(false),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("relationships_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.sourceMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    check("relationships_type_check", enumCheck(t.type, RELATIONSHIP_TYPES)),
    ...serverEntityChecks("relationships", t),
  ],
);

export const systemStructureEntityTypes = pgTable(
  "system_structure_entity_types",
  {
    ...entityIdentity<SystemStructureEntityTypeId>(),
    sortOrder: integer("sort_order").notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("system_structure_entity_types_system_archived_idx").on(t.systemId, t.archived),
    unique("system_structure_entity_types_id_system_id_unique").on(t.id, t.systemId),
    ...serverEntityChecks("system_structure_entity_types", t),
  ],
);

export const systemStructureEntities = pgTable(
  "system_structure_entities",
  {
    ...entityIdentity<SystemStructureEntityId>(),
    entityTypeId: brandedId<SystemStructureEntityTypeId>("entity_type_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("system_structure_entities_system_archived_idx").on(t.systemId, t.archived),
    index("system_structure_entities_entity_type_id_idx").on(t.systemId, t.entityTypeId),
    unique("system_structure_entities_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.entityTypeId, t.systemId],
      foreignColumns: [systemStructureEntityTypes.id, systemStructureEntityTypes.systemId],
    }).onDelete("restrict"),
    ...serverEntityChecks("system_structure_entities", t),
  ],
);

export const systemStructureEntityLinks = pgTable(
  "system_structure_entity_links",
  {
    id: brandedId<SystemStructureEntityLinkId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityId: brandedId<SystemStructureEntityId>("entity_id").notNull(),
    parentEntityId: brandedId<SystemStructureEntityId>("parent_entity_id"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("system_structure_entity_links_system_entity_idx").on(t.systemId, t.entityId),
    index("system_structure_entity_links_system_parent_idx").on(t.systemId, t.parentEntityId),
    unique("system_structure_entity_links_entity_parent_uniq")
      .on(t.entityId, t.parentEntityId)
      .nullsNotDistinct(),
    foreignKey({
      columns: [t.entityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.parentEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
  ],
);

export const systemStructureEntityMemberLinks = pgTable(
  "system_structure_entity_member_links",
  {
    id: brandedId<SystemStructureEntityMemberLinkId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentEntityId: brandedId<SystemStructureEntityId>("parent_entity_id"),
    memberId: brandedId<MemberId>("member_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("system_structure_entity_member_links_system_member_idx").on(t.systemId, t.memberId),
    index("system_structure_entity_member_links_system_parent_idx").on(
      t.systemId,
      t.parentEntityId,
    ),
    unique("system_structure_entity_member_links_member_parent_uniq")
      .on(t.memberId, t.parentEntityId)
      .nullsNotDistinct(),
    foreignKey({
      columns: [t.parentEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Directed associations between structure entities (source → target).
 * The unique constraint on (sourceEntityId, targetEntityId) intentionally allows
 * both (A, B) and (B, A) as distinct associations. Application-level logic should
 * enforce ordering if undirected semantics are desired.
 */
export const systemStructureEntityAssociations = pgTable(
  "system_structure_entity_associations",
  {
    id: brandedId<SystemStructureEntityAssociationId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sourceEntityId: brandedId<SystemStructureEntityId>("source_entity_id").notNull(),
    targetEntityId: brandedId<SystemStructureEntityId>("target_entity_id").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("system_structure_entity_associations_uniq").on(t.sourceEntityId, t.targetEntityId),
    index("system_structure_entity_associations_system_source_idx").on(
      t.systemId,
      t.sourceEntityId,
    ),
    index("system_structure_entity_associations_system_target_idx").on(
      t.systemId,
      t.targetEntityId,
    ),
    foreignKey({
      columns: [t.sourceEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    check(
      "system_structure_entity_associations_no_self_link",
      sql`${t.sourceEntityId} <> ${t.targetEntityId}`,
    ),
  ],
);

export type RelationshipRow = InferSelectModel<typeof relationships>;
export type NewRelationship = InferInsertModel<typeof relationships>;
export type SystemStructureEntityTypeRow = InferSelectModel<typeof systemStructureEntityTypes>;
export type NewSystemStructureEntityType = InferInsertModel<typeof systemStructureEntityTypes>;
export type SystemStructureEntityRow = InferSelectModel<typeof systemStructureEntities>;
export type NewSystemStructureEntity = InferInsertModel<typeof systemStructureEntities>;
export type SystemStructureEntityLinkRow = InferSelectModel<typeof systemStructureEntityLinks>;
export type NewSystemStructureEntityLink = InferInsertModel<typeof systemStructureEntityLinks>;
export type SystemStructureEntityMemberLinkRow = InferSelectModel<
  typeof systemStructureEntityMemberLinks
>;
export type NewSystemStructureEntityMemberLink = InferInsertModel<
  typeof systemStructureEntityMemberLinks
>;
export type SystemStructureEntityAssociationRow = InferSelectModel<
  typeof systemStructureEntityAssociations
>;
export type NewSystemStructureEntityAssociation = InferInsertModel<
  typeof systemStructureEntityAssociations
>;
