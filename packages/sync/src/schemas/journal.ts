import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";
import type { JournalEntryId, WikiPageId } from "@pluralscape/types";

// ── journal entry ─────────────────────────────────────────────────────

/**
 * CRDT representation of a JournalEntry (append-lww map, keyed by JournalEntryId).
 * New entries are added by ID assignment; content fields (title, blocks, tags,
 * linkedEntities) are mutable after creation via LWW per field.
 */
export interface CrdtJournalEntry extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  /** JSON-serialized EntityReference<"member"|"structure-entity"> | null */
  author: CrdtOptionalString;
  frontingSessionId: CrdtOptionalString;
  title: CrdtString;
  /** JSON-serialized JournalBlock[] */
  blocks: CrdtString;
  /** JSON-serialized string[] */
  tags: CrdtString;
  /** JSON-serialized EntityLink[] */
  linkedEntities: CrdtString;
  /** JSON-serialized FrontingSnapshot[] | null */
  frontingSnapshots: CrdtOptionalString;
  archived: boolean;
}

// ── wiki page ─────────────────────────────────────────────────────────

/** CRDT representation of a WikiPage (LWW map, keyed by WikiPageId). */
export interface CrdtWikiPage extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  title: CrdtString;
  slug: CrdtString;
  /** JSON-serialized JournalBlock[] */
  blocks: CrdtString;
  /** JSON-serialized WikiPageId[] */
  linkedFromPages: CrdtString;
  /** JSON-serialized string[] */
  tags: CrdtString;
  /** JSON-serialized EntityLink[] */
  linkedEntities: CrdtString;
  archived: boolean;
}

// ── document ─────────────────────────────────────────────────────────

/**
 * Automerge document schema for the journal document.
 *
 * Contains long-form writing — journal entries and wiki pages.
 * Time-split by year when document exceeds 10 MB.
 *
 * Encryption key: Master key
 * Naming: journal-{systemId} (splits to journal-{systemId}-{YYYY})
 */
export interface JournalDocument {
  /** Append-lww map: entries keyed by JournalEntryId; content is mutable after creation. */
  entries: Record<JournalEntryId, CrdtJournalEntry>;
  /** LWW map keyed by WikiPageId. */
  wikiPages: Record<WikiPageId, CrdtWikiPage>;
}
