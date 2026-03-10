import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { BlobPurpose } from "@pluralscape/types";

export const blobMetadata = sqliteTable(
  "blob_metadata",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull(),
    encryptionTier: integer("encryption_tier").notNull(),
    bucketId: text("bucket_id").references(() => buckets.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull().$type<BlobPurpose>(),
    thumbnailOfBlobId: text("thumbnail_of_blob_id"),
    checksum: text("checksum"),
    uploadedAt: sqliteTimestamp("uploaded_at").notNull(),
  },
  (t) => [
    index("blob_metadata_system_id_idx").on(t.systemId),
    uniqueIndex("blob_metadata_storage_key_idx").on(t.storageKey),
    foreignKey({
      columns: [t.thumbnailOfBlobId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
  ],
);
