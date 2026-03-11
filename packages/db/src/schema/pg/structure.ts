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
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { DISCOVERY_STATUSES, RELATIONSHIP_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerRelationship, ServerSubsystem } from "@pluralscape/types";

export const relationships = pgTable(
  "relationships",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sourceMemberId: varchar("source_member_id", { length: 255 }),
    targetMemberId: varchar("target_member_id", { length: 255 }),
    type: varchar("type", { length: 255 }).$type<ServerRelationship["type"]>(),
    bidirectional: boolean("bidirectional"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("relationships_system_id_idx").on(t.systemId),
    check("relationships_type_check", enumCheck(t.type, RELATIONSHIP_TYPES)),
  ],
);

export const subsystems = pgTable(
  "subsystems",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentSubsystemId: varchar("parent_subsystem_id", { length: 255 }),
    architectureType: jsonb("architecture_type"),
    hasCore: boolean("has_core"),
    discoveryStatus: varchar("discovery_status", { length: 255 }).$type<
      ServerSubsystem["discoveryStatus"]
    >(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("subsystems_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.parentSubsystemId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("subsystems_discovery_status_check", enumCheck(t.discoveryStatus, DISCOVERY_STATUSES)),
  ],
);

export const sideSystems = pgTable(
  "side_systems",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("side_systems_system_id_idx").on(t.systemId)],
);

export const layers = pgTable(
  "layers",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    // Ties are intentionally allowed; no uniqueness constraint on sortOrder
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("layers_system_id_idx").on(t.systemId),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const subsystemMemberships = pgTable(
  "subsystem_memberships",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: 255 })
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("subsystem_memberships_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_memberships_system_id_idx").on(t.systemId),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const sideSystemMemberships = pgTable(
  "side_system_memberships",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sideSystemId: varchar("side_system_id", { length: 255 })
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("side_system_memberships_side_system_id_idx").on(t.sideSystemId),
    index("side_system_memberships_system_id_idx").on(t.systemId),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const layerMemberships = pgTable(
  "layer_memberships",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    layerId: varchar("layer_id", { length: 255 })
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("layer_memberships_layer_id_idx").on(t.layerId),
    index("layer_memberships_system_id_idx").on(t.systemId),
  ],
);

export const subsystemLayerLinks = pgTable(
  "subsystem_layer_links",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: 255 })
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    layerId: varchar("layer_id", { length: 255 })
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_layer_links_uniq").on(t.subsystemId, t.layerId),
    index("subsystem_layer_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_layer_links_layer_id_idx").on(t.layerId),
  ],
);

export const subsystemSideSystemLinks = pgTable(
  "subsystem_side_system_links",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    subsystemId: varchar("subsystem_id", { length: 255 })
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    sideSystemId: varchar("side_system_id", { length: 255 })
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_side_system_links_uniq").on(t.subsystemId, t.sideSystemId),
    index("subsystem_side_system_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_side_system_links_side_system_id_idx").on(t.sideSystemId),
  ],
);

export const sideSystemLayerLinks = pgTable(
  "side_system_layer_links",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sideSystemId: varchar("side_system_id", { length: 255 })
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    layerId: varchar("layer_id", { length: 255 })
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("side_system_layer_links_uniq").on(t.sideSystemId, t.layerId),
    index("side_system_layer_links_side_system_id_idx").on(t.sideSystemId),
    index("side_system_layer_links_layer_id_idx").on(t.layerId),
  ],
);
