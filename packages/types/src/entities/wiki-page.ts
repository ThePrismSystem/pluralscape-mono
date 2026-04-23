import type { SystemId, WikiPageId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { EntityLink, JournalBlock } from "./journal-entry.js";

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
export type ArchivedWikiPage = Archived<WikiPage>;
