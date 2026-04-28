import { foreignKey, index, pgTable, unique } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versionCheckFor, versioned } from "../../helpers/audit.pg.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";

import { systems } from "./systems.js";

import type { InnerWorldEntityId, InnerWorldRegionId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Regions must be declared before entities (entities FK to regions)
export const innerworldRegions = pgTable(
  "innerworld_regions",
  {
    ...entityIdentity<InnerWorldRegionId>(),
    parentRegionId: brandedId<InnerWorldRegionId>("parent_region_id"),
    ...encryptedPayload(),
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
    }).onDelete("restrict"),
    ...serverEntityChecks("innerworld_regions", t),
  ],
);

export const innerworldEntities = pgTable(
  "innerworld_entities",
  {
    ...entityIdentity<InnerWorldEntityId>(),
    regionId: brandedId<InnerWorldRegionId>("region_id"),
    ...encryptedPayload(),
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
    }).onDelete("restrict"),
    ...serverEntityChecks("innerworld_entities", t),
  ],
);

// Singleton per system — systemId is the primary key. entityIdentity does not
// fit (no separate id column).
export const innerworldCanvas = pgTable(
  "innerworld_canvas",
  {
    systemId: brandedId<SystemId>("system_id")
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
