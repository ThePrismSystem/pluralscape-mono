import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import {
  DOCUMENT_ID_MAX_LENGTH,
  ENUM_MAX_LENGTH,
  ID_MAX_LENGTH,
} from "../../helpers/db.constants.js";
import { SYNC_DOC_TYPES, SYNC_KEY_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { SyncDocumentType, DocumentKeyType } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const syncDocuments = pgTable(
  "sync_documents",
  {
    documentId: varchar("document_id", { length: DOCUMENT_ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    docType: varchar("doc_type", { length: ENUM_MAX_LENGTH }).notNull().$type<SyncDocumentType>(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    snapshotVersion: integer("snapshot_version").notNull().default(0),
    lastSeq: integer("last_seq").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    timePeriod: varchar("time_period", { length: ENUM_MAX_LENGTH }),
    keyType: varchar("key_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("derived")
      .$type<DocumentKeyType>(),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH }),
    channelId: varchar("channel_id", { length: ID_MAX_LENGTH }),
    createdAt: pgTimestamp("created_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
  },
  (t) => [
    index("sync_documents_system_id_idx").on(t.systemId),
    index("sync_documents_system_id_doc_type_idx").on(t.systemId, t.docType),
    check("sync_documents_doc_type_check", enumCheck(t.docType, SYNC_DOC_TYPES)),
    check("sync_documents_key_type_check", enumCheck(t.keyType, SYNC_KEY_TYPES)),
    check("sync_documents_size_bytes_check", sql`${t.sizeBytes} >= 0`),
    check("sync_documents_snapshot_version_check", sql`${t.snapshotVersion} >= 0`),
    check("sync_documents_last_seq_check", sql`${t.lastSeq} >= 0`),
  ],
);

export const syncChanges = pgTable(
  "sync_changes",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    documentId: varchar("document_id", { length: DOCUMENT_ID_MAX_LENGTH })
      .notNull()
      .references(() => syncDocuments.documentId, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    encryptedPayload: pgBinary("encrypted_payload").notNull(),
    authorPublicKey: pgBinary("author_public_key").notNull(),
    nonce: pgBinary("nonce").notNull(),
    signature: pgBinary("signature").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("sync_changes_document_id_seq_idx").on(t.documentId, t.seq),
    uniqueIndex("sync_changes_dedup_idx").on(t.documentId, t.authorPublicKey, t.nonce),
  ],
);

export const syncSnapshots = pgTable("sync_snapshots", {
  documentId: varchar("document_id", { length: DOCUMENT_ID_MAX_LENGTH })
    .primaryKey()
    .references(() => syncDocuments.documentId, { onDelete: "cascade" }),
  snapshotVersion: integer("snapshot_version").notNull(),
  encryptedPayload: pgBinary("encrypted_payload").notNull(),
  authorPublicKey: pgBinary("author_public_key").notNull(),
  nonce: pgBinary("nonce").notNull(),
  signature: pgBinary("signature").notNull(),
  createdAt: pgTimestamp("created_at").notNull(),
});

export type SyncDocumentRow = InferSelectModel<typeof syncDocuments>;
export type NewSyncDocument = InferInsertModel<typeof syncDocuments>;
export type SyncChangeRow = InferSelectModel<typeof syncChanges>;
export type NewSyncChange = InferInsertModel<typeof syncChanges>;
export type SyncSnapshotRow = InferSelectModel<typeof syncSnapshots>;
export type NewSyncSnapshot = InferInsertModel<typeof syncSnapshots>;
