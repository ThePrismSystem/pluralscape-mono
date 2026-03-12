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

import { pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck, enumCheck, versionCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { FIELD_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { ServerFieldDefinition } from "@pluralscape/types";

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    fieldType: varchar("field_type", { length: ENUM_MAX_LENGTH }).$type<
      ServerFieldDefinition["fieldType"]
    >(),
    required: boolean("required"),
    sortOrder: integer("sort_order"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("field_definitions_system_id_idx").on(t.systemId),
    unique("field_definitions_id_system_id_unique").on(t.id, t.systemId),
    check("field_definitions_field_type_check", enumCheck(t.fieldType, FIELD_TYPES)),
    check("field_definitions_version_check", versionCheck(t.version)),
    check(
      "field_definitions_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const fieldValues = pgTable(
  "field_values",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    fieldDefinitionId: varchar("field_definition_id", { length: ID_MAX_LENGTH }).notNull(),
    memberId: varchar("member_id", { length: ID_MAX_LENGTH }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("field_values_definition_system_idx").on(t.fieldDefinitionId, t.systemId),
    foreignKey({
      columns: [t.fieldDefinitionId, t.systemId],
      foreignColumns: [fieldDefinitions.id, fieldDefinitions.systemId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete("set null"),
    check("field_values_version_check", versionCheck(t.version)),
    uniqueIndex("field_values_definition_member_uniq")
      .on(t.fieldDefinitionId, t.memberId)
      .where(sql`${t.memberId} IS NOT NULL`),
    uniqueIndex("field_values_definition_system_uniq")
      .on(t.fieldDefinitionId, t.systemId)
      .where(sql`${t.memberId} IS NULL`),
  ],
);

export const fieldBucketVisibility = pgTable(
  "field_bucket_visibility",
  {
    fieldDefinitionId: varchar("field_definition_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fieldDefinitionId, t.bucketId] })],
);
