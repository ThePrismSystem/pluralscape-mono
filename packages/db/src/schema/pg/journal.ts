import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

import type {
  FrontingSessionId,
  JournalEntryId,
  SlugHash,
  SystemId,
  WikiPageId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: brandedId<JournalEntryId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("journal_entries_system_id_created_at_idx").on(t.systemId, t.createdAt),
    index("journal_entries_system_archived_idx").on(t.systemId, t.archived),
    // fronting_session_id FK is application-enforced only — PostgreSQL cannot
    // enforce FKs against a partitioned table without the partition key (ADR 019).
    index("journal_entries_fronting_session_id_idx").on(t.frontingSessionId),
    versionCheckFor("journal_entries", t.version),
    archivableConsistencyCheckFor("journal_entries", t.archived, t.archivedAt),
  ],
);

export const wikiPages = pgTable(
  "wiki_pages",
  {
    id: brandedId<WikiPageId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    // slugHash is a SHA-256 hex digest of the decrypted slug — server-visible
    // for uniqueness enforcement without ever reading the slug. Branded
    // `SlugHash` to prevent accidental mixing with other 64-char hex values.
    slugHash: varchar("slug_hash", { length: 64 }).notNull().$type<SlugHash>(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_archived_idx").on(t.systemId, t.archived),
    uniqueIndex("wiki_pages_system_id_slug_hash_idx")
      .on(t.systemId, t.slugHash)
      .where(sql`${t.archived} = false`),
    versionCheckFor("wiki_pages", t.version),
    archivableConsistencyCheckFor("wiki_pages", t.archived, t.archivedAt),
    check("wiki_pages_slug_hash_length_check", sql`length(${t.slugHash}) = 64`),
  ],
);

export type JournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;
export type WikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewWikiPage = InferInsertModel<typeof wikiPages>;
