import { sql } from "drizzle-orm";
import { check, foreignKey, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck, versionCheck } from "../../helpers/check.js";

import { frontingSessions } from "./fronting.js";
import { systems } from "./systems.js";

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
    index("journal_entries_fronting_session_id_idx").on(t.frontingSessionId),
    foreignKey({
      columns: [t.frontingSessionId],
      foreignColumns: [frontingSessions.id],
    }).onDelete("set null"),
    check("journal_entries_version_check", versionCheck(t.version)),
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
    index("wiki_pages_system_id_idx").on(t.systemId),
    uniqueIndex("wiki_pages_system_id_slug_hash_idx").on(t.systemId, t.slugHash),
    check("wiki_pages_version_check", versionCheck(t.version)),
    check(
      "wiki_pages_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
    check("wiki_pages_slug_hash_length_check", sql`length(${t.slugHash}) = 64`),
  ],
);
