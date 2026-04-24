import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";

import { frontingSessions } from "./fronting.js";
import { systems } from "./systems.js";

import type {
  FrontingSessionId,
  JournalEntryId,
  SlugHash,
  SystemId,
  WikiPageId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: brandedId<JournalEntryId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id"),
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
    }).onDelete("restrict"),
    versionCheckFor("journal_entries", t.version),
    archivableConsistencyCheckFor("journal_entries", t.archived, t.archivedAt),
  ],
);

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    id: brandedId<WikiPageId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    // slugHash is a SHA-256 hex digest of the decrypted slug — server-visible
    // for uniqueness enforcement without ever reading the slug. Branded
    // `SlugHash` to prevent accidental mixing with other 64-char hex values.
    slugHash: text("slug_hash").notNull().$type<SlugHash>(),
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
    archivableConsistencyCheckFor("wiki_pages", t.archived, t.archivedAt),
    check("wiki_pages_slug_hash_length_check", sql`length(${t.slugHash}) = 64`),
  ],
);

export type JournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;
export type WikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewWikiPage = InferInsertModel<typeof wikiPages>;
