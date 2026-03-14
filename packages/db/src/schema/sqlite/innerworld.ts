import { check, foreignKey, index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck } from "../../helpers/check.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
    ...archivable(),
  },
  (t) => [
    index("innerworld_regions_system_id_idx").on(t.systemId),
    index("innerworld_regions_system_archived_idx").on(t.systemId, t.archived),
    unique("innerworld_regions_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentRegionId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("set null"),
    versionCheckFor("innerworld_regions", t.version),
    check(
      "innerworld_regions_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
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
    regionId: text("region_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("innerworld_entities_system_id_idx").on(t.systemId),
    index("innerworld_entities_region_id_idx").on(t.regionId),
    index("innerworld_entities_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.regionId],
      foreignColumns: [innerworldRegions.id],
    }).onDelete("set null"),
    versionCheckFor("innerworld_entities", t.version),
    check(
      "innerworld_entities_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const innerworldCanvas = sqliteTable(
  "innerworld_canvas",
  {
    systemId: text("system_id")
      .primaryKey()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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
