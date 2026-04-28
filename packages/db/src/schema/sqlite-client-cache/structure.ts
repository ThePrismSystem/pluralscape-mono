import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import { members } from "./members.js";

import type {
  HexColor,
  ImageSource,
  MemberId,
  RelationshipId,
  RelationshipType,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `SystemStructureEntityType`.
 */
export const systemStructureEntityTypes = sqliteTable("structure_entity_types", {
  ...entityIdentity<SystemStructureEntityTypeId>(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").$type<HexColor | null>(),
  imageSource: sqliteJsonOf<ImageSource | null>("image_source"),
  emoji: text("emoji"),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `SystemStructureEntity`.
 */
export const systemStructureEntities = sqliteTable(
  "structure_entities",
  {
    ...entityIdentity<SystemStructureEntityId>(),
    entityTypeId: brandedId<SystemStructureEntityTypeId>("entity_type_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").$type<HexColor | null>(),
    imageSource: sqliteJsonOf<ImageSource | null>("image_source"),
    emoji: text("emoji"),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.entityTypeId, t.systemId],
      foreignColumns: [systemStructureEntityTypes.id, systemStructureEntityTypes.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Decrypted client-cache projection of `Relationship`. The discriminated
 * union over `type` is collapsed in the cache: the optional `label` column
 * is non-null only when `type === "custom"`.
 */
export const relationships = sqliteTable(
  "relationships",
  {
    ...entityIdentity<RelationshipId>(),
    sourceMemberId: brandedId<MemberId>("source_member_id"),
    targetMemberId: brandedId<MemberId>("target_member_id"),
    type: text("type").$type<RelationshipType>().notNull(),
    label: text("label"),
    bidirectional: integer("bidirectional", { mode: "boolean" }).notNull(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.sourceMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Plaintext entity — no encrypted payload. Mirrors
 * `SystemStructureEntityLink` exactly.
 */
export const systemStructureEntityLinks = sqliteTable(
  "structure_entity_links",
  {
    ...entityIdentity<SystemStructureEntityLinkId>(),
    entityId: brandedId<SystemStructureEntityId>("entity_id").notNull(),
    parentEntityId: brandedId<SystemStructureEntityId>("parent_entity_id"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.entityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.parentEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Plaintext entity — no encrypted payload. Mirrors
 * `SystemStructureEntityMemberLink` exactly.
 */
export const systemStructureEntityMemberLinks = sqliteTable(
  "structure_entity_member_links",
  {
    ...entityIdentity<SystemStructureEntityMemberLinkId>(),
    parentEntityId: brandedId<SystemStructureEntityId>("parent_entity_id"),
    memberId: brandedId<MemberId>("member_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Plaintext entity — no encrypted payload. Mirrors
 * `SystemStructureEntityAssociation` exactly.
 */
export const systemStructureEntityAssociations = sqliteTable(
  "structure_entity_associations",
  {
    ...entityIdentity<SystemStructureEntityAssociationId>(),
    sourceEntityId: brandedId<SystemStructureEntityId>("source_entity_id").notNull(),
    targetEntityId: brandedId<SystemStructureEntityId>("target_entity_id").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.sourceEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
  ],
);

export type LocalRelationshipRow = InferSelectModel<typeof relationships>;
export type NewLocalRelationship = InferInsertModel<typeof relationships>;
export type LocalSystemStructureEntityTypeRow = InferSelectModel<typeof systemStructureEntityTypes>;
export type NewLocalSystemStructureEntityType = InferInsertModel<typeof systemStructureEntityTypes>;
export type LocalSystemStructureEntityRow = InferSelectModel<typeof systemStructureEntities>;
export type NewLocalSystemStructureEntity = InferInsertModel<typeof systemStructureEntities>;
export type LocalSystemStructureEntityLinkRow = InferSelectModel<typeof systemStructureEntityLinks>;
export type NewLocalSystemStructureEntityLink = InferInsertModel<typeof systemStructureEntityLinks>;
export type LocalSystemStructureEntityMemberLinkRow = InferSelectModel<
  typeof systemStructureEntityMemberLinks
>;
export type NewLocalSystemStructureEntityMemberLink = InferInsertModel<
  typeof systemStructureEntityMemberLinks
>;
export type LocalSystemStructureEntityAssociationRow = InferSelectModel<
  typeof systemStructureEntityAssociations
>;
export type NewLocalSystemStructureEntityAssociation = InferInsertModel<
  typeof systemStructureEntityAssociations
>;
