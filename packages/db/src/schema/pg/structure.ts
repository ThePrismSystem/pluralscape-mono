import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
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
import { DISCOVERY_STATUSES, RELATIONSHIP_TYPES } from "../../helpers/enums.js";

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

export const subsystems = pgTable(
  "subsystems",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentSubsystemId: varchar("parent_subsystem_id", { length: ID_MAX_LENGTH }),
    architectureType: jsonb("architecture_type"),
    hasCore: boolean("has_core").notNull().default(false),
    discoveryStatus: varchar("discovery_status", { length: ENUM_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("subsystems_system_archived_idx").on(t.systemId, t.archived),
    unique("subsystems_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentSubsystemId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("restrict"),
    check("subsystems_discovery_status_check", enumCheck(t.discoveryStatus, DISCOVERY_STATUSES)),
    versionCheckFor("subsystems", t.version),
    archivableConsistencyCheckFor("subsystems", t.archived, t.archivedAt),
  ],
);

export const sideSystems = pgTable(
  "side_systems",
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
    index("side_systems_system_archived_idx").on(t.systemId, t.archived),
    unique("side_systems_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("side_systems", t.version),
    archivableConsistencyCheckFor("side_systems", t.archived, t.archivedAt),
  ],
);

export const layers = pgTable(
  "layers",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    // Ties are intentionally allowed; no uniqueness constraint on sortOrder
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("layers_system_archived_idx").on(t.systemId, t.archived),
    unique("layers_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("layers", t.version),
    archivableConsistencyCheckFor("layers", t.archived, t.archivedAt),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const subsystemMemberships = pgTable(
  "subsystem_memberships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: ID_MAX_LENGTH }).notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("subsystem_memberships_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_memberships_member_id_idx").on(t.memberId),
    index("subsystem_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.subsystemId, t.systemId],
      foreignColumns: [subsystems.id, subsystems.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export const sideSystemMemberships = pgTable(
  "side_system_memberships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    sideSystemId: varchar("side_system_id", { length: ID_MAX_LENGTH }).notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("side_system_memberships_side_system_id_idx").on(t.sideSystemId),
    index("side_system_memberships_member_id_idx").on(t.memberId),
    index("side_system_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.sideSystemId, t.systemId],
      foreignColumns: [sideSystems.id, sideSystems.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export const layerMemberships = pgTable(
  "layer_memberships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    layerId: varchar("layer_id", { length: ID_MAX_LENGTH }).notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("layer_memberships_layer_id_idx").on(t.layerId),
    index("layer_memberships_member_id_idx").on(t.memberId),
    index("layer_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export const subsystemLayerLinks = pgTable(
  "subsystem_layer_links",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: ID_MAX_LENGTH }).notNull(),
    layerId: varchar("layer_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_layer_links_uniq").on(t.subsystemId, t.layerId),
    index("subsystem_layer_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_layer_links_layer_id_idx").on(t.layerId),
    foreignKey({
      columns: [t.subsystemId, t.systemId],
      foreignColumns: [subsystems.id, subsystems.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("restrict"),
  ],
);

export const subsystemSideSystemLinks = pgTable(
  "subsystem_side_system_links",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: ID_MAX_LENGTH }).notNull(),
    sideSystemId: varchar("side_system_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_side_system_links_uniq").on(t.subsystemId, t.sideSystemId),
    index("subsystem_side_system_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_side_system_links_side_system_id_idx").on(t.sideSystemId),
    foreignKey({
      columns: [t.subsystemId, t.systemId],
      foreignColumns: [subsystems.id, subsystems.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.sideSystemId, t.systemId],
      foreignColumns: [sideSystems.id, sideSystems.systemId],
    }).onDelete("restrict"),
  ],
);

export const sideSystemLayerLinks = pgTable(
  "side_system_layer_links",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    sideSystemId: varchar("side_system_id", { length: ID_MAX_LENGTH }).notNull(),
    layerId: varchar("layer_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("side_system_layer_links_uniq").on(t.sideSystemId, t.layerId),
    index("side_system_layer_links_side_system_id_idx").on(t.sideSystemId),
    index("side_system_layer_links_layer_id_idx").on(t.layerId),
    foreignKey({
      columns: [t.sideSystemId, t.systemId],
      foreignColumns: [sideSystems.id, sideSystems.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("restrict"),
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
    index("system_structure_entities_entity_type_id_idx").on(t.entityTypeId),
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
    index("system_structure_entity_links_entity_id_idx").on(t.entityId),
    index("system_structure_entity_links_parent_entity_id_idx").on(t.parentEntityId),
    index("system_structure_entity_links_system_id_idx").on(t.systemId),
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
    index("system_structure_entity_member_links_parent_entity_id_idx").on(t.parentEntityId),
    index("system_structure_entity_member_links_member_id_idx").on(t.memberId),
    index("system_structure_entity_member_links_system_id_idx").on(t.systemId),
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
    index("system_structure_entity_associations_source_idx").on(t.sourceEntityId),
    index("system_structure_entity_associations_target_idx").on(t.targetEntityId),
    index("system_structure_entity_associations_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.sourceEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
  ],
);

export type RelationshipRow = InferSelectModel<typeof relationships>;
export type NewRelationship = InferInsertModel<typeof relationships>;
export type SubsystemRow = InferSelectModel<typeof subsystems>;
export type NewSubsystem = InferInsertModel<typeof subsystems>;
export type SideSystemRow = InferSelectModel<typeof sideSystems>;
export type NewSideSystem = InferInsertModel<typeof sideSystems>;
export type LayerRow = InferSelectModel<typeof layers>;
export type NewLayer = InferInsertModel<typeof layers>;
export type SubsystemMembershipRow = InferSelectModel<typeof subsystemMemberships>;
export type NewSubsystemMembership = InferInsertModel<typeof subsystemMemberships>;
export type SideSystemMembershipRow = InferSelectModel<typeof sideSystemMemberships>;
export type NewSideSystemMembership = InferInsertModel<typeof sideSystemMemberships>;
export type LayerMembershipRow = InferSelectModel<typeof layerMemberships>;
export type NewLayerMembership = InferInsertModel<typeof layerMemberships>;
export type SubsystemLayerLinkRow = InferSelectModel<typeof subsystemLayerLinks>;
export type NewSubsystemLayerLink = InferInsertModel<typeof subsystemLayerLinks>;
export type SubsystemSideSystemLinkRow = InferSelectModel<typeof subsystemSideSystemLinks>;
export type NewSubsystemSideSystemLink = InferInsertModel<typeof subsystemSideSystemLinks>;
export type SideSystemLayerLinkRow = InferSelectModel<typeof sideSystemLayerLinks>;
export type NewSideSystemLayerLink = InferInsertModel<typeof sideSystemLayerLinks>;
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
