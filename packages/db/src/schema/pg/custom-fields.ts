import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId } from "../../columns/pg.js";
import { archivable, timestamps, versionCheckFor, versioned } from "../../helpers/audit.pg.js";
import { enumCheck, exclusiveNullCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";
import { FIELD_DEFINITION_SCOPE_TYPES, FIELD_TYPES } from "../../helpers/enums.js";

import { groups } from "./groups.js";
import { members } from "./members.js";
import { buckets } from "./privacy.js";
import { systemStructureEntities, systemStructureEntityTypes } from "./structure.js";
import { systems } from "./systems.js";

import type {
  BucketId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
  FieldType,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    ...entityIdentity<FieldDefinitionId>(),
    fieldType: varchar("field_type", { length: ENUM_MAX_LENGTH }).notNull().$type<FieldType>(),
    required: boolean("required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("field_definitions_system_archived_idx").on(t.systemId, t.archived),
    unique("field_definitions_id_system_id_unique").on(t.id, t.systemId),
    check("field_definitions_field_type_check", enumCheck(t.fieldType, FIELD_TYPES)),
    ...serverEntityChecks("field_definitions", t),
  ],
);

// Carve-out for serverEntityChecks: field_values is not archivable (CRDT
// replaces values on update). entityIdentity and encryptedPayload still apply.
export const fieldValues = pgTable(
  "field_values",
  {
    ...entityIdentity<FieldValueId>(),
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id").notNull(),
    memberId: brandedId<MemberId>("member_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    groupId: brandedId<GroupId>("group_id"),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("field_values_definition_system_idx").on(t.fieldDefinitionId, t.systemId),
    index("field_values_system_member_idx").on(t.systemId, t.memberId),
    index("field_values_system_entity_idx").on(t.systemId, t.structureEntityId),
    index("field_values_system_group_idx").on(t.systemId, t.groupId),
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
    versionCheckFor("field_values", t.version),
    uniqueIndex("field_values_definition_member_uniq")
      .on(t.fieldDefinitionId, t.memberId)
      .where(sql`${t.memberId} IS NOT NULL`),
    uniqueIndex("field_values_definition_entity_uniq")
      .on(t.fieldDefinitionId, t.structureEntityId)
      .where(sql`${t.structureEntityId} IS NOT NULL`),
    uniqueIndex("field_values_definition_group_uniq")
      .on(t.fieldDefinitionId, t.groupId)
      .where(sql`${t.groupId} IS NOT NULL`),
    uniqueIndex("field_values_definition_system_uniq")
      .on(t.fieldDefinitionId, t.systemId)
      .where(
        sql`${t.memberId} IS NULL AND ${t.structureEntityId} IS NULL AND ${t.groupId} IS NULL`,
      ),
    check(
      "field_values_subject_exclusivity_check",
      exclusiveNullCheck(t.memberId, t.structureEntityId, t.groupId),
    ),
  ],
);

// Pure link table — no entity identity, no encrypted payload, no audit.
export const fieldBucketVisibility = pgTable(
  "field_bucket_visibility",
  {
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "restrict" }),
    bucketId: brandedId<BucketId>("bucket_id")
      .notNull()
      .references(() => buckets.id, { onDelete: "restrict" }),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.fieldDefinitionId, t.bucketId] }),
    index("field_bucket_visibility_bucket_id_idx").on(t.bucketId),
    index("field_bucket_visibility_system_id_idx").on(t.systemId),
  ],
);

// Carve-outs: not archivable, no encrypted payload. entityIdentity applies.
export const fieldDefinitionScopes = pgTable(
  "field_definition_scopes",
  {
    ...entityIdentity<FieldDefinitionScopeId>(),
    fieldDefinitionId: brandedId<FieldDefinitionId>("field_definition_id").notNull(),
    scopeType: varchar("scope_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<"system" | "member" | "group" | "structure-entity-type">(),
    scopeEntityTypeId: brandedId<SystemStructureEntityTypeId>("scope_entity_type_id"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("field_definition_scopes_field_definition_id_idx").on(t.fieldDefinitionId),
    foreignKey({
      columns: [t.fieldDefinitionId, t.systemId],
      foreignColumns: [fieldDefinitions.id, fieldDefinitions.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.scopeEntityTypeId, t.systemId],
      foreignColumns: [systemStructureEntityTypes.id, systemStructureEntityTypes.systemId],
    }).onDelete("restrict"),
    check(
      "field_definition_scopes_scope_type_check",
      enumCheck(t.scopeType, FIELD_DEFINITION_SCOPE_TYPES),
    ),
    check(
      "field_definition_scopes_entity_type_check",
      sql`${t.scopeEntityTypeId} IS NULL OR ${t.scopeType} = 'structure-entity-type'`,
    ),
    index("field_definition_scopes_system_id_idx").on(t.systemId),
    unique("field_definition_scopes_definition_scope_uniq")
      .on(t.fieldDefinitionId, t.scopeType, t.scopeEntityTypeId)
      .nullsNotDistinct(),
    uniqueIndex("field_definition_scopes_definition_scope_null_uniq")
      .on(t.fieldDefinitionId, t.scopeType)
      .where(sql`${t.scopeEntityTypeId} IS NULL`),
    versionCheckFor("field_definition_scopes", t.version),
  ],
);

export type FieldDefinitionRow = InferSelectModel<typeof fieldDefinitions>;
export type NewFieldDefinition = InferInsertModel<typeof fieldDefinitions>;
export type FieldValueRow = InferSelectModel<typeof fieldValues>;
export type NewFieldValue = InferInsertModel<typeof fieldValues>;
export type FieldBucketVisibilityRow = InferSelectModel<typeof fieldBucketVisibility>;
export type NewFieldBucketVisibility = InferInsertModel<typeof fieldBucketVisibility>;
export type FieldDefinitionScopeRow = InferSelectModel<typeof fieldDefinitionScopes>;
export type NewFieldDefinitionScope = InferInsertModel<typeof fieldDefinitionScopes>;
