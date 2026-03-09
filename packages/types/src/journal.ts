import type { JournalEntryId, MemberId, SystemId, WikiPageId } from "./ids.js";
import type { AuditMetadata } from "./utility.js";

/** The kind of content a journal block contains. */
export type JournalBlockType =
  | "paragraph"
  | "heading"
  | "list"
  | "quote"
  | "code"
  | "image"
  | "divider"
  | "callout"
  | "toggle";

/** A single block of content within a journal entry or wiki page. */
export interface JournalBlock {
  readonly type: JournalBlockType;
  readonly content: string;
  readonly metadata: Readonly<Record<string, string>> | null;
  readonly children: readonly JournalBlock[];
}

/** An entity link connecting a journal/wiki to another entity. */
export interface EntityLink {
  readonly entityType: string;
  readonly entityId: string;
  readonly label: string | null;
}

/** A journal entry authored by one or more members. */
export interface JournalEntry extends AuditMetadata {
  readonly id: JournalEntryId;
  readonly systemId: SystemId;
  readonly authorMemberIds: readonly MemberId[];
  readonly title: string;
  readonly blocks: readonly JournalBlock[];
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  readonly archived: false;
}

/** A wiki page for persistent system documentation. */
export interface WikiPage extends AuditMetadata {
  readonly id: WikiPageId;
  readonly systemId: SystemId;
  readonly title: string;
  readonly blocks: readonly JournalBlock[];
  readonly parentPageId: WikiPageId | null;
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  readonly archived: false;
}
