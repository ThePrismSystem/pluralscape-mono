import { foreignKey, index, pgTable, unique, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = pgTable(
  "innerworld_regions",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    parentRegionId: varchar("parent_region_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("innerworld_regions_system_archived_idx").on(t.systemId, t.archived),
    unique("innerworld_regions_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentRegionId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("set null"),
    versionCheckFor("innerworld_regions", t.version),
    archivableConsistencyCheckFor("innerworld_regions", t.archived, t.archivedAt),
  ],
);

export const innerworldEntities = pgTable(
  "innerworld_entities",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    regionId: varchar("region_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("innerworld_entities_region_id_idx").on(t.regionId),
    index("innerworld_entities_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.regionId],
      foreignColumns: [innerworldRegions.id],
    }).onDelete("set null"),
    versionCheckFor("innerworld_entities", t.version),
    archivableConsistencyCheckFor("innerworld_entities", t.archived, t.archivedAt),
  ],
);

export const innerworldCanvas = pgTable(
  "innerworld_canvas",
  {
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [versionCheckFor("innerworld_canvas", t.version)],
);

export type InnerworldRegionRow = InferSelectModel<typeof innerworldRegions>;
export type NewInnerworldRegion = InferInsertModel<typeof innerworldRegions>;
export type InnerworldEntityRow = InferSelectModel<typeof innerworldEntities>;
export type NewInnerworldEntity = InferInsertModel<typeof innerworldEntities>;
export type InnerworldCanvasRow = InferSelectModel<typeof innerworldCanvas>;
export type NewInnerworldCanvas = InferInsertModel<typeof innerworldCanvas>;
