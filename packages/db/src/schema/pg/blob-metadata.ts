import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgTimestamp } from "../../columns/pg.js";
import { archivable, archivableConsistencyCheckFor } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, MAX_BLOB_SIZE_BYTES } from "../../helpers/db.constants.js";
import { BLOB_PURPOSES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type {
  BlobId,
  BlobPurpose,
  BucketId,
  ChecksumHex,
  EncryptionTier,
  SystemId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const blobMetadata = pgTable(
  "blob_metadata",
  {
    id: brandedId<BlobId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 1024 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    encryptionTier: integer("encryption_tier").notNull().$type<EncryptionTier>(),
    bucketId: brandedId<BucketId>("bucket_id"),
    purpose: varchar("purpose", { length: ENUM_MAX_LENGTH }).notNull().$type<BlobPurpose>(),
    thumbnailOfBlobId: brandedId<BlobId>("thumbnail_of_blob_id"),
    checksum: varchar("checksum", { length: 255 }).$type<ChecksumHex>(),
    createdAt: pgTimestamp("created_at").notNull(),
    uploadedAt: pgTimestamp("uploaded_at"),
    expiresAt: pgTimestamp("expires_at"),
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
