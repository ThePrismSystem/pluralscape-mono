import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { FIELD_TYPES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { ServerFieldDefinition } from "@pluralscape/types";

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    fieldType: varchar("field_type", { length: 255 }).$type<ServerFieldDefinition["fieldType"]>(),
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
  ],
);

export const fieldValues = pgTable(
  "field_values",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    fieldDefinitionId: varchar("field_definition_id", { length: 255 }).notNull(),
    memberId: varchar("member_id", { length: 255 }),
    systemId: varchar("system_id", { length: 255 })
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
  ],
);

export const fieldBucketVisibility = pgTable(
  "field_bucket_visibility",
  {
    fieldDefinitionId: varchar("field_definition_id", { length: 255 })
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    bucketId: varchar("bucket_id", { length: 255 })
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fieldDefinitionId, t.bucketId] })],
);
