import { foreignKey, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";

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
  ],
);

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_id_idx").on(t.systemId),
    uniqueIndex("wiki_pages_system_id_slug_idx").on(t.systemId, t.slug),
  ],
);
