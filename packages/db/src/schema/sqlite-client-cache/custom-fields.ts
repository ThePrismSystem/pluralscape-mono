import { foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import { groups } from "./groups.js";
import { members } from "./members.js";
import { systemStructureEntities, systemStructureEntityTypes } from "./structure.js";

import type {
  BucketId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
  FieldDefinitionScopeType,
  FieldType,
  FieldValueId,
  FieldValueUnion,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `FieldDefinition`.
 */
export const fieldDefinitions = sqliteTable("field_definitions", {
  ...entityIdentity<FieldDefinitionId>(),
  name: text("name").notNull(),
  description: text("description"),
  fieldType: text("field_type").$type<FieldType>().notNull(),
  options: sqliteJsonOf<readonly string[] | null>("options"),
  required: integer("required", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `FieldValue`. The discriminated
 * `FieldValueUnion` rides as JSON in the `value` column (matching the
 * shape in the encrypted payload).
 *
 * Carve-out: not archivable on the server (CRDT-replaced on update).
 */
export const fieldValues = sqliteTable(
  "field_values",
  {
    ...entityIdentity<FieldValueId>(),
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id").notNull(),
    memberId: brandedId<MemberId>("member_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    groupId: brandedId<GroupId>("group_id"),
    value: sqliteJsonOf<FieldValueUnion>("value").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      columns: [t.fieldDefinitionId, t.systemId],
      foreignColumns: [fieldDefinitions.id, fieldDefinitions.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.structureEntityId, t.systemId],
      foreignColumns: [systemStructureEntities.id, systemStructureEntities.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.groupId, t.systemId],
      foreignColumns: [groups.id, groups.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Pure link table — no entity identity, no encrypted payload, no audit.
 * Mirrors `FieldBucketVisibility` exactly.
 */
export const fieldBucketVisibility = sqliteTable(
  "field_bucket_visibility",
  {
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id").notNull(),
    bucketId: brandedId<BucketId>("bucket_id").notNull(),
    systemId: brandedId<SystemId>("system_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.fieldDefinitionId, t.bucketId] }),
    foreignKey({
      columns: [t.fieldDefinitionId, t.systemId],
      foreignColumns: [fieldDefinitions.id, fieldDefinitions.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Decrypted client-cache projection of `FieldDefinitionScope`. Plaintext
 * entity — no encrypted payload, not archivable.
 */
export const fieldDefinitionScopes = sqliteTable(
  "field_definition_scopes",
  {
    ...entityIdentity<FieldDefinitionScopeId>(),
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id").notNull(),
    scopeType: text("scope_type").$type<FieldDefinitionScopeType>().notNull(),
    scopeEntityTypeId: brandedId<SystemStructureEntityTypeId>("scope_entity_type_id"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      columns: [t.fieldDefinitionId, t.systemId],
      foreignColumns: [fieldDefinitions.id, fieldDefinitions.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.scopeEntityTypeId, t.systemId],
      foreignColumns: [systemStructureEntityTypes.id, systemStructureEntityTypes.systemId],
    }).onDelete("restrict"),
  ],
);

export type LocalFieldDefinitionRow = InferSelectModel<typeof fieldDefinitions>;
export type NewLocalFieldDefinition = InferInsertModel<typeof fieldDefinitions>;
export type LocalFieldValueRow = InferSelectModel<typeof fieldValues>;
export type NewLocalFieldValue = InferInsertModel<typeof fieldValues>;
export type LocalFieldBucketVisibilityRow = InferSelectModel<typeof fieldBucketVisibility>;
export type NewLocalFieldBucketVisibility = InferInsertModel<typeof fieldBucketVisibility>;
export type LocalFieldDefinitionScopeRow = InferSelectModel<typeof fieldDefinitionScopes>;
export type NewLocalFieldDefinitionScope = InferInsertModel<typeof fieldDefinitionScopes>;
