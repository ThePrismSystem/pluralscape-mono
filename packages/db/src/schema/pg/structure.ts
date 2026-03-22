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
import { RELATIONSHIP_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerRelationship } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const relationships = pgTable(
  "relationships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sourceMemberId: varchar("source_member_id", { length: ID_MAX_LENGTH }),
    targetMemberId: varchar("target_member_id", { length: ID_MAX_LENGTH }),
    type: varchar("type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<ServerRelationship["type"]>(),
    bidirectional: boolean("bidirectional").notNull().default(false),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("relationships", t.version),
    archivableConsistencyCheckFor("relationships", t.archived, t.archivedAt),
  ],
);

export const systemStructureEntityTypes = pgTable(
  "system_structure_entity_types",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("system_structure_entity_types_system_archived_idx").on(t.systemId, t.archived),
    unique("system_structure_entity_types_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("system_structure_entity_types", t.version),
    archivableConsistencyCheckFor("system_structure_entity_types", t.archived, t.archivedAt),
  ],
);

export const systemStructureEntities = pgTable(
  "system_structure_entities",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityTypeId: varchar("entity_type_id", { length: ID_MAX_LENGTH }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("system_structure_entities", t.version),
    archivableConsistencyCheckFor("system_structure_entities", t.archived, t.archivedAt),
  ],
);

export const systemStructureEntityLinks = pgTable(
  "system_structure_entity_links",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    parentEntityId: varchar("parent_entity_id", { length: ID_MAX_LENGTH }),
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
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentEntityId: varchar("parent_entity_id", { length: ID_MAX_LENGTH }),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
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
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sourceEntityId: varchar("source_entity_id", { length: ID_MAX_LENGTH }).notNull(),
    targetEntityId: varchar("target_entity_id", { length: ID_MAX_LENGTH }).notNull(),
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
