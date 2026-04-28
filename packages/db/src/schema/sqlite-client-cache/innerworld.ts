import { foreignKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  InnerWorldEntityId,
  InnerWorldEntityType,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  VisualProperties,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `InnerWorldRegion`.
 */
export const innerworldRegions = sqliteTable(
  "innerworld_regions",
  {
    ...entityIdentity<InnerWorldRegionId>(),
    parentRegionId: brandedId<InnerWorldRegionId>("parent_region_id"),
    name: text("name").notNull(),
    description: text("description"),
    visual: sqliteJsonOf<VisualProperties>("visual").notNull(),
    boundaryData:
      sqliteJsonOf<readonly { readonly x: number; readonly y: number }[]>(
        "boundary_data",
      ).notNull(),
    accessType: text("access_type").$type<"open" | "gatekept">().notNull(),
    gatekeeperMemberIds: sqliteJsonOf<readonly MemberId[]>("gatekeeper_member_ids").notNull(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentRegionId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Decrypted client-cache projection of `InnerWorldEntity`. Discriminated
 * union over `entityType` is collapsed: variant-specific columns
 * (`name`, `description`, `linkedMemberId`, `linkedStructureEntityId`)
 * are nullable and populated only for the matching `entityType`.
 */
export const innerworldEntities = sqliteTable("innerworld_entities", {
  ...entityIdentity<InnerWorldEntityId>(),
  regionId: brandedId<InnerWorldRegionId>("region_id"),
  entityType: text("entity_type").$type<InnerWorldEntityType>().notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  visual: sqliteJsonOf<VisualProperties>("visual").notNull(),
  name: text("name"),
  description: text("description"),
  linkedMemberId: brandedId<MemberId>("linked_member_id"),
  linkedStructureEntityId: brandedId<SystemStructureEntityId>("linked_structure_entity_id"),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `InnerWorldCanvas`. Singleton per
 * system — `systemId` is the primary key.
 */
export const innerworldCanvas = sqliteTable("innerworld_canvas", {
  systemId: brandedId<SystemId>("system_id").primaryKey(),
  viewportX: real("viewport_x").notNull(),
  viewportY: real("viewport_y").notNull(),
  zoom: real("zoom").notNull(),
  dimensions: sqliteJsonOf<{ readonly width: number; readonly height: number }>(
    "dimensions",
  ).notNull(),
  ...timestamps(),
});

export type LocalInnerworldRegionRow = InferSelectModel<typeof innerworldRegions>;
export type NewLocalInnerworldRegion = InferInsertModel<typeof innerworldRegions>;
export type LocalInnerworldEntityRow = InferSelectModel<typeof innerworldEntities>;
export type NewLocalInnerworldEntity = InferInsertModel<typeof innerworldEntities>;
export type LocalInnerworldCanvasRow = InferSelectModel<typeof innerworldCanvas>;
export type NewLocalInnerworldCanvas = InferInsertModel<typeof innerworldCanvas>;
