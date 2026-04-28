import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { brandedId } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";

import { frontingSessions } from "./fronting.js";

import type { FrontingSessionId, JournalEntryId, SlugHash, WikiPageId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    ...entityIdentity<JournalEntryId>(),
    frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id"),
    ...encryptedPayload(),
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
    ...serverEntityChecks("journal_entries", t),
  ],
);

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    ...entityIdentity<WikiPageId>(),
    // slugHash is a SHA-256 hex digest of the decrypted slug — server-visible
    // for uniqueness enforcement without ever reading the slug. Branded
    // `SlugHash` to prevent accidental mixing with other 64-char hex values.
    slugHash: text("slug_hash").notNull().$type<SlugHash>(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_archived_idx").on(t.systemId, t.archived),
    uniqueIndex("wiki_pages_system_id_slug_hash_idx")
      .on(t.systemId, t.slugHash)
      .where(sql`${t.archived} = 0`),
    ...serverEntityChecks("wiki_pages", t),
    check("wiki_pages_slug_hash_length_check", sql`length(${t.slugHash}) = 64`),
  ],
);

export type JournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;
export type WikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewWikiPage = InferInsertModel<typeof wikiPages>;
