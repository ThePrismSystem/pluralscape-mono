import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  AnyBrandedId,
  EntityLink,
  FrontingSessionId,
  FrontingSnapshot,
  JournalBlock,
  JournalEntryId,
  SlugHash,
  WikiPageId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `JournalEntry`. The polymorphic
 * `author` field is flattened into discriminator/id columns matching the
 * server-side encoding pattern used by other polymorphic entities.
 */
export const journalEntries = sqliteTable("journal_entries", {
  ...entityIdentity<JournalEntryId>(),
  authorEntityType: text("author_entity_type").$type<"member" | "structure-entity" | null>(),
  authorEntityId: brandedId<AnyBrandedId>("author_entity_id"),
  frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id"),
  title: text("title").notNull(),
  blocks: sqliteJsonOf<readonly JournalBlock[]>("blocks").notNull(),
  tags: sqliteJsonOf<readonly string[]>("tags").notNull(),
  linkedEntities: sqliteJsonOf<readonly EntityLink[]>("linked_entities").notNull(),
  frontingSnapshots: sqliteJsonOf<readonly FrontingSnapshot[] | null>("fronting_snapshots"),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `WikiPage`. Server-only `slugHash`
 * is preserved for slug-based lookups against the encrypted server row.
 */
export const wikiPages = sqliteTable("wiki_pages", {
  ...entityIdentity<WikiPageId>(),
  slugHash: text("slug_hash").$type<SlugHash>().notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  blocks: sqliteJsonOf<readonly JournalBlock[]>("blocks").notNull(),
  linkedFromPages: sqliteJsonOf<readonly WikiPageId[]>("linked_from_pages").notNull(),
  tags: sqliteJsonOf<readonly string[]>("tags").notNull(),
  linkedEntities: sqliteJsonOf<readonly EntityLink[]>("linked_entities").notNull(),
  ...timestamps(),
  ...archivable(),
});

export type LocalJournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewLocalJournalEntry = InferInsertModel<typeof journalEntries>;
export type LocalWikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewLocalWikiPage = InferInsertModel<typeof wikiPages>;
