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

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { BLOB_PURPOSES } from "../../helpers/enums.js";

import { buckets } from "./privacy.js";
import { systems } from "./systems.js";

import type { BlobPurpose } from "@pluralscape/types";

export const blobMetadata = pgTable(
  "blob_metadata",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 1024 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    encryptionTier: integer("encryption_tier").notNull(),
    bucketId: varchar("bucket_id", { length: 255 }),
    purpose: varchar("purpose", { length: 255 }).notNull().$type<BlobPurpose>(),
    thumbnailOfBlobId: varchar("thumbnail_of_blob_id", { length: 255 }),
    checksum: varchar("checksum", { length: 255 }).notNull(),
    uploadedAt: pgTimestamp("uploaded_at").notNull(),
  },
  (t) => [
    index("blob_metadata_system_id_idx").on(t.systemId),
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
    check("blob_metadata_encryption_tier_check", sql`${t.encryptionTier} IN (1, 2)`),
  ],
);
