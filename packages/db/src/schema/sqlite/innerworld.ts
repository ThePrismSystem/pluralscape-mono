import { check, foreignKey, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteJson } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { INNERWORLD_ENTITY_TYPES, INNERWORLD_REGION_ACCESS_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerInnerWorldEntity, ServerInnerWorldRegion } from "@pluralscape/types";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = sqliteTable(
  "innerworld_regions",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentRegionId: text("parent_region_id"),
    accessType: text("access_type").notNull().$type<ServerInnerWorldRegion["accessType"]>(),
    gatekeeperMemberIds: sqliteJson("gatekeeper_member_ids").notNull().$type<readonly string[]>(),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("innerworld_regions_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.parentRegionId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check(
      "innerworld_regions_access_type_check",
      enumCheck(t.accessType, INNERWORLD_REGION_ACCESS_TYPES),
    ),
  ],
);

export const innerworldEntities = sqliteTable(
  "innerworld_entities",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().$type<ServerInnerWorldEntity["entityType"]>(),
    regionId: text("region_id").references(() => innerworldRegions.id, { onDelete: "set null" }),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("innerworld_entities_system_id_idx").on(t.systemId),
    index("innerworld_entities_region_id_idx").on(t.regionId),
    check(
      "innerworld_entities_entity_type_check",
      enumCheck(t.entityType, INNERWORLD_ENTITY_TYPES),
    ),
  ],
);

export const innerworldCanvas = sqliteTable("innerworld_canvas", {
  systemId: text("system_id")
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: sqliteBinary("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
