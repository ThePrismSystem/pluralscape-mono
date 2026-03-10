import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { timestamps, versioned } from "../../helpers/audit.sqlite.js";

import { systems } from "./systems.js";

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    author: sqliteJson("author"),
    frontingSessionId: text("fronting_session_id"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: sqliteTimestamp("archived_at"),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("journal_entries_system_id_created_at_idx").on(t.systemId, t.createdAt)],
);

export const wikiPages = sqliteTable(
  "wiki_pages",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: sqliteTimestamp("archived_at"),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("wiki_pages_system_id_idx").on(t.systemId)],
);
