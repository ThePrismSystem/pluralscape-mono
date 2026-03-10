import { boolean, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    author: jsonb("author"),
    frontingSessionId: varchar("fronting_session_id", { length: 255 }),
    archived: boolean("archived").notNull().default(false),
    archivedAt: pgTimestamp("archived_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("journal_entries_system_id_created_at_idx").on(t.systemId, t.createdAt)],
);

export const wikiPages = pgTable(
  "wiki_pages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    archived: boolean("archived").notNull().default(false),
    archivedAt: pgTimestamp("archived_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("wiki_pages_system_id_idx").on(t.systemId)],
);
