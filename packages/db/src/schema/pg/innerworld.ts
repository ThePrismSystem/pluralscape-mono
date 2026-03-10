import { check, foreignKey, index, integer, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { INNERWORLD_ENTITY_TYPES, INNERWORLD_REGION_ACCESS_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerInnerWorldEntity, ServerInnerWorldRegion } from "@pluralscape/types";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = pgTable(
  "innerworld_regions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentRegionId: varchar("parent_region_id", { length: 255 }),
    accessType: varchar("access_type", { length: 255 })
      .notNull()
      .$type<ServerInnerWorldRegion["accessType"]>(),
    gatekeeperMemberIds: jsonb("gatekeeper_member_ids").notNull().$type<readonly string[]>(),
    encryptedData: pgBinary("encrypted_data").notNull(),
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

export const innerworldEntities = pgTable(
  "innerworld_entities",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 255 })
      .notNull()
      .$type<ServerInnerWorldEntity["entityType"]>(),
    regionId: varchar("region_id", { length: 255 }).references(() => innerworldRegions.id, {
      onDelete: "set null",
    }),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
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

export const innerworldCanvas = pgTable("innerworld_canvas", {
  systemId: varchar("system_id", { length: 255 })
    .primaryKey()
    .references(() => systems.id, { onDelete: "cascade" }),
  encryptedData: pgBinary("encrypted_data").notNull(),
  ...timestamps(),
  ...versioned(),
});
