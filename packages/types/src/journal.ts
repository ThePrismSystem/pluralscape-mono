import type {
  BlobId,
  EntityType,
  FrontingSessionId,
  JournalEntryId,
  MemberId,
  SystemId,
  WikiPageId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

// ── Journal Block types (discriminated union) ──────────────────────

/** Shared base fields for all journal block types (unexported). */
interface JournalBlockBase {
  readonly children: readonly JournalBlock[];
}

/** A paragraph of text. */
export interface ParagraphBlock extends JournalBlockBase {
  readonly type: "paragraph";
  readonly content: string;
}

/** Valid heading levels (1-6, matching HTML h1-h6). */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** A heading with level 1-6. */
export interface HeadingBlock extends JournalBlockBase {
  readonly type: "heading";
  readonly content: string;
  readonly level: HeadingLevel;
}

/** An ordered or unordered list. */
export interface ListBlock extends JournalBlockBase {
  readonly type: "list";
  readonly items: readonly string[];
  readonly ordered: boolean;
}

/** A block quote. */
export interface QuoteBlock extends JournalBlockBase {
  readonly type: "quote";
  readonly content: string;
}

/** A code block with optional language. */
export interface CodeBlock extends JournalBlockBase {
  readonly type: "code";
  readonly content: string;
  readonly language: string | null;
}

/** An image referenced by blob ID. */
export interface ImageBlock extends JournalBlockBase {
  readonly type: "image";
  readonly blobId: BlobId;
  readonly caption: string | null;
}

/** A horizontal divider with no content. */
export interface DividerBlock extends JournalBlockBase {
  readonly type: "divider";
}

/** A link to a member within the system. */
export interface MemberLinkBlock extends JournalBlockBase {
  readonly type: "member-link";
  readonly memberId: MemberId;
  readonly displayText: string;
}

/** A link to any entity in the system. */
export interface EntityLinkBlock extends JournalBlockBase {
  readonly type: "entity-link";
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly displayText: string;
}

/** All journal block variants — discriminated on type. */
export type JournalBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | ImageBlock
  | DividerBlock
  | MemberLinkBlock
  | EntityLinkBlock;

/** The set of valid journal block type strings. */
export type JournalBlockType = JournalBlock["type"];

// ── Entity links ───────────────────────────────────────────────────

/** An entity link connecting a journal/wiki to another entity. */
export interface EntityLink {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly displayText: string;
}

// ── Journal entries ────────────────────────────────────────────────

/** A journal entry authored by a member. */
export interface JournalEntry extends AuditMetadata {
  readonly id: JournalEntryId;
  readonly systemId: SystemId;
  readonly authorMemberId: MemberId | null;
  readonly frontingSessionId: FrontingSessionId | null;
  readonly title: string;
  readonly blocks: readonly JournalBlock[];
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  readonly archived: false;
}

/** An archived journal entry. */
export interface ArchivedJournalEntry extends Omit<JournalEntry, "archived">, AuditMetadata {
  readonly archived: true;
  readonly archivedAt: UnixMillis;
}

// ── Wiki pages ─────────────────────────────────────────────────────

/** A wiki page for persistent system documentation. */
export interface WikiPage extends AuditMetadata {
  readonly id: WikiPageId;
  readonly systemId: SystemId;
  readonly title: string;
  readonly slug: string;
  readonly blocks: readonly JournalBlock[];
  readonly linkedFromPages: readonly WikiPageId[];
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  readonly archived: false;
}

/** An archived wiki page. */
export interface ArchivedWikiPage extends Omit<WikiPage, "archived">, AuditMetadata {
  readonly archived: true;
  readonly archivedAt: UnixMillis;
}
