import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned, versionCheckFor } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck } from "../../helpers/check.js";

import { frontingSessions } from "./fronting.js";
import { systems } from "./systems.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    frontingSessionId: text("fronting_session_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("journal_entries_system_id_created_at_idx").on(t.systemId, t.createdAt),
    index("journal_entries_system_archived_idx").on(t.systemId, t.archived),
    index("journal_entries_fronting_session_id_idx").on(t.frontingSessionId),
    foreignKey({
      columns: [t.frontingSessionId],
      foreignColumns: [frontingSessions.id],
    }).onDelete("set null"),
    versionCheckFor("journal_entries", t.version),
    check(
      "journal_entries_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    slugHash: text("slug_hash").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_archived_idx").on(t.systemId, t.archived),
    uniqueIndex("wiki_pages_system_id_slug_hash_idx")
      .on(t.systemId, t.slugHash)
      .where(sql`${t.archived} = 0`),
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
