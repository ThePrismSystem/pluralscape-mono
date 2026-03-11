import { foreignKey, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("relationships_system_id_idx").on(t.systemId)],
);

export const subsystems = sqliteTable(
  "subsystems",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentSubsystemId: text("parent_subsystem_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("subsystems_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.parentSubsystemId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
  ],
);

export const sideSystems = sqliteTable(
  "side_systems",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("side_systems_system_id_idx").on(t.systemId)],
);

export const layers = sqliteTable(
  "layers",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    // Ties are intentionally allowed; no uniqueness constraint on sortOrder
    sortOrder: integer("sort_order").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("layers_system_id_idx").on(t.systemId)],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const subsystemMemberships = sqliteTable(
  "subsystem_memberships",
  {
    id: text("id").primaryKey(),
    subsystemId: text("subsystem_id")
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("subsystem_memberships_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_memberships_system_id_idx").on(t.systemId),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const sideSystemMemberships = sqliteTable(
  "side_system_memberships",
  {
    id: text("id").primaryKey(),
    sideSystemId: text("side_system_id")
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("side_system_memberships_side_system_id_idx").on(t.sideSystemId),
    index("side_system_memberships_system_id_idx").on(t.systemId),
  ],
);

// Member identity is inside encryptedData; uniqueness enforced at application layer
export const layerMemberships = sqliteTable(
  "layer_memberships",
  {
    id: text("id").primaryKey(),
    layerId: text("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("layer_memberships_layer_id_idx").on(t.layerId),
    index("layer_memberships_system_id_idx").on(t.systemId),
  ],
);

export const subsystemLayerLinks = sqliteTable(
  "subsystem_layer_links",
  {
    id: text("id").primaryKey(),
    subsystemId: text("subsystem_id")
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    layerId: text("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_layer_links_uniq").on(t.subsystemId, t.layerId),
    index("subsystem_layer_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_layer_links_layer_id_idx").on(t.layerId),
  ],
);

export const subsystemSideSystemLinks = sqliteTable(
  "subsystem_side_system_links",
  {
    id: text("id").primaryKey(),
    subsystemId: text("subsystem_id")
      .notNull()
      .references(() => subsystems.id, { onDelete: "cascade" }),
    sideSystemId: text("side_system_id")
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("subsystem_side_system_links_uniq").on(t.subsystemId, t.sideSystemId),
    index("subsystem_side_system_links_subsystem_id_idx").on(t.subsystemId),
    index("subsystem_side_system_links_side_system_id_idx").on(t.sideSystemId),
  ],
);

export const sideSystemLayerLinks = sqliteTable(
  "side_system_layer_links",
  {
    id: text("id").primaryKey(),
    sideSystemId: text("side_system_id")
      .notNull()
      .references(() => sideSystems.id, { onDelete: "cascade" }),
    layerId: text("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data"),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("side_system_layer_links_uniq").on(t.sideSystemId, t.layerId),
    index("side_system_layer_links_side_system_id_idx").on(t.sideSystemId),
    index("side_system_layer_links_layer_id_idx").on(t.layerId),
  ],
);
