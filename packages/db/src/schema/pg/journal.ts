import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob } from "../../columns/pg.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { archivableConsistencyCheck } from "../../helpers/check.js";
import { ID_MAX_LENGTH } from "../../helpers/constants.js";

import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    frontingSessionId: varchar("fronting_session_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("journal_entries_system_id_created_at_idx").on(t.systemId, t.createdAt),
    // fronting_session_id FK is application-enforced only — PostgreSQL cannot
    // enforce FKs against a partitioned table without the partition key (ADR 019).
    index("journal_entries_fronting_session_id_idx").on(t.frontingSessionId),
    versionCheckFor("journal_entries", t.version),
    check(
      "journal_entries_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const wikiPages = pgTable(
  "wiki_pages",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    slugHash: varchar("slug_hash", { length: 64 }).notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_id_idx").on(t.systemId),
    index("wiki_pages_system_archived_idx").on(t.systemId, t.archived),
    uniqueIndex("wiki_pages_system_id_slug_hash_idx").on(t.systemId, t.slugHash),
    versionCheckFor("wiki_pages", t.version),
    check(
      "wiki_pages_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
    check("wiki_pages_slug_hash_length_check", sql`length(${t.slugHash}) = 64`),
  ],
);

export type JournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;
export type WikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewWikiPage = InferInsertModel<typeof wikiPages>;
