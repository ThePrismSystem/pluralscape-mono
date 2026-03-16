import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, archivableConsistencyCheckFor } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { MAX_BLOB_SIZE_BYTES } from "../../helpers/db.constants.js";
import { BLOB_PURPOSES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { BlobPurpose, EncryptionTier } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const blobMetadata = sqliteTable(
  "blob_metadata",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    /** SQLite integer is 64-bit in practice; PG uses bigint explicitly. Semantically equivalent but distinguish when comparing raw schemas. */
    sizeBytes: integer("size_bytes").notNull(),
    encryptionTier: integer("encryption_tier").notNull().$type<EncryptionTier>(),
    bucketId: text("bucket_id"),
    purpose: text("purpose").notNull().$type<BlobPurpose>(),
    thumbnailOfBlobId: text("thumbnail_of_blob_id"),
    checksum: text("checksum").notNull(),
    uploadedAt: sqliteTimestamp("uploaded_at").notNull(),
    ...archivable(),
  },
  (t) => [
    index("blob_metadata_system_id_purpose_idx").on(t.systemId, t.purpose),
    index("blob_metadata_system_archived_idx").on(t.systemId, t.archived),
    uniqueIndex("blob_metadata_storage_key_idx").on(t.storageKey),
    unique("blob_metadata_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.bucketId],
      foreignColumns: [buckets.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.thumbnailOfBlobId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("blob_metadata_purpose_check", enumCheck(t.purpose, BLOB_PURPOSES)),
    check("blob_metadata_size_bytes_check", sql`${t.sizeBytes} > 0`),
    check(
      "blob_metadata_size_bytes_max_check",
      sql`${t.sizeBytes} <= ${sql.raw(String(MAX_BLOB_SIZE_BYTES))}`,
    ),
    check("blob_metadata_encryption_tier_check", sql`${t.encryptionTier} IN (1, 2)`),
    check("blob_metadata_checksum_length_check", sql`length(${t.checksum}) = 64`),
    archivableConsistencyCheckFor("blob_metadata", t.archived, t.archivedAt),
  ],
);

export type BlobMetadataRow = InferSelectModel<typeof blobMetadata>;
export type NewBlobMetadata = InferInsertModel<typeof blobMetadata>;
