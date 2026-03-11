import { foreignKey, index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = sqliteTable(
  "innerworld_regions",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentRegionId: text("parent_region_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("innerworld_regions_system_id_idx").on(t.systemId),
    unique("innerworld_regions_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentRegionId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
  ],
);

export const innerworldEntities = sqliteTable(
  "innerworld_entities",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    regionId: text("region_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("innerworld_entities_system_id_idx").on(t.systemId),
    index("innerworld_entities_region_id_idx").on(t.regionId),
    foreignKey({
      columns: [t.regionId],
      foreignColumns: [innerworldRegions.id],
    }).onDelete("set null"),
  ],
);

export const innerworldCanvas = sqliteTable("innerworld_canvas", {
  systemId: text("system_id")
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
