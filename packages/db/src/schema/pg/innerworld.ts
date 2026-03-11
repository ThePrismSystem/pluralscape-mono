import { foreignKey, index, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = pgTable(
  "innerworld_regions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentRegionId: varchar("parent_region_id", { length: 255 }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

export const innerworldEntities = pgTable(
  "innerworld_entities",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    regionId: varchar("region_id", { length: 255 }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

export const innerworldCanvas = pgTable("innerworld_canvas", {
  systemId: varchar("system_id", { length: 255 })
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
