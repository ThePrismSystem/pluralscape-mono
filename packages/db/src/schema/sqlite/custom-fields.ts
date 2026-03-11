import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

export const fieldDefinitions = sqliteTable(
  "field_definitions",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [index("field_definitions_system_id_idx").on(t.systemId)],
);

export const fieldValues = sqliteTable(
  "field_values",
  {
    id: text("id").primaryKey(),
    fieldDefinitionId: text("field_definition_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("field_values_definition_system_idx").on(t.fieldDefinitionId, t.systemId)],
);

export const fieldBucketVisibility = sqliteTable(
  "field_bucket_visibility",
  {
    fieldDefinitionId: text("field_definition_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fieldDefinitionId, t.bucketId] })],
);
