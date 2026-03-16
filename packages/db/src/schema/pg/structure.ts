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

import type { ServerRelationship, ServerSubsystem } from "@pluralscape/types";
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
    }).onDelete("set null"),
    foreignKey({
      columns: [t.targetMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("set null"),
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
    architectureType: jsonb("architecture_type").$type<ServerSubsystem["architectureType"]>(),
    hasCore: boolean("has_core").notNull().default(false),
    discoveryStatus: varchar("discovery_status", { length: ENUM_MAX_LENGTH }).$type<
      ServerSubsystem["discoveryStatus"]
    >(),
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
    }).onDelete("set null"),
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
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("subsystem_memberships_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.subsystemId, t.systemId],
      foreignColumns: [subsystems.id, subsystems.systemId],
    }).onDelete("cascade"),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const sideSystemMemberships = pgTable(
  "side_system_memberships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    sideSystemId: varchar("side_system_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("side_system_memberships_side_system_id_idx").on(t.sideSystemId),
    index("side_system_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.sideSystemId, t.systemId],
      foreignColumns: [sideSystems.id, sideSystems.systemId],
    }).onDelete("cascade"),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const layerMemberships = pgTable(
  "layer_memberships",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    layerId: varchar("layer_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("layer_memberships_layer_id_idx").on(t.layerId),
    index("layer_memberships_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.sideSystemId, t.systemId],
      foreignColumns: [sideSystems.id, sideSystems.systemId],
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.layerId, t.systemId],
      foreignColumns: [layers.id, layers.systemId],
    }).onDelete("cascade"),
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
