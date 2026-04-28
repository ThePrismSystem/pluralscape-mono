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

import { brandedId, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, archivableConsistencyCheckFor } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { MAX_BLOB_SIZE_BYTES } from "../../helpers/db.constants.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";
import { BLOB_PURPOSES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";

import type {
  BlobId,
  BlobPurpose,
  BucketId,
  ChecksumHex,
  EncryptionTier,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: blob metadata has no encrypted payload (the blob itself is the
// encrypted payload, stored externally), no version tracking, and bespoke
// createdAt/uploadedAt/expiresAt timestamps instead of the standard mixin.
export const blobMetadata = sqliteTable(
  "blob_metadata",
  {
    ...entityIdentity<BlobId>(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    /** SQLite integer is 64-bit in practice; PG uses bigint explicitly. Semantically equivalent but distinguish when comparing raw schemas. */
    sizeBytes: integer("size_bytes").notNull(),
    encryptionTier: integer("encryption_tier").notNull().$type<EncryptionTier>(),
    bucketId: brandedId<BucketId>("bucket_id"),
    purpose: text("purpose").notNull().$type<BlobPurpose>(),
    thumbnailOfBlobId: brandedId<BlobId>("thumbnail_of_blob_id"),
    checksum: text("checksum").$type<ChecksumHex>(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    uploadedAt: sqliteTimestamp("uploaded_at"),
    expiresAt: sqliteTimestamp("expires_at"),
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
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.thumbnailOfBlobId],
      foreignColumns: [t.id],
    }).onDelete("restrict"),
    check("blob_metadata_purpose_check", enumCheck(t.purpose, BLOB_PURPOSES)),
    check("blob_metadata_size_bytes_check", sql`${t.sizeBytes} > 0`),
    check(
      "blob_metadata_size_bytes_max_check",
      sql`${t.sizeBytes} <= ${sql.raw(String(MAX_BLOB_SIZE_BYTES))}`,
    ),
    check("blob_metadata_encryption_tier_check", sql`${t.encryptionTier} IN (1, 2)`),
    check(
      "blob_metadata_checksum_length_check",
      sql`${t.checksum} IS NULL OR length(${t.checksum}) = 64`,
    ),
    check(
      "blob_metadata_pending_consistency_check",
      sql`(${t.checksum} IS NULL) = (${t.uploadedAt} IS NULL)`,
    ),
    archivableConsistencyCheckFor("blob_metadata", t.archived, t.archivedAt),
  ],
);

export type BlobMetadataRow = InferSelectModel<typeof blobMetadata>;
export type NewBlobMetadata = InferInsertModel<typeof blobMetadata>;
