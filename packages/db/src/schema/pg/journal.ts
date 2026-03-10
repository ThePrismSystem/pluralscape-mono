import { index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
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
    slug: varchar("slug", { length: 255 }).notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("wiki_pages_system_id_idx").on(t.systemId),
    uniqueIndex("wiki_pages_system_id_slug_idx").on(t.systemId, t.slug),
  ],
);
