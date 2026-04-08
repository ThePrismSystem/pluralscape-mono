/**
 * Journal entry mapper.
 *
 * SP `notes` → Pluralscape journal entries. The SP note body is plain text
 * (or optionally markdown — we drop the markdown flag and import as plain
 * text for now), which we wrap in a single `ParagraphBlock` matching the
 * Pluralscape rich-text schema from `@pluralscape/types/journal.ts`.
 *
 * `sp.color` and `sp.supportMarkdown` have no Pluralscape equivalents and are
 * dropped with warnings so users can audit what was lost during import.
 *
 * Fails when the author FK can't be resolved.
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPNote } from "../sources/sp-types.js";

/**
 * Minimal paragraph block shape compatible with Pluralscape's
 * {@link import("@pluralscape/types").ParagraphBlock}. The persister
 * upcasts this into a full `JournalBlock[]` when encrypting.
 */
export interface MappedJournalParagraphBlock {
  readonly type: "paragraph";
  readonly content: string;
  readonly children: readonly never[];
}

export interface MappedJournalEntry {
  readonly title: string;
  /**
   * Mirrors Pluralscape `JournalEntry.author`'s `EntityReference` shape,
   * narrowed to the `"member"` variant. SP has no structure-entity
   * equivalent, so the discriminant is always `"member"`.
   */
  readonly author: { readonly entityType: "member"; readonly entityId: string };
  readonly blocks: readonly MappedJournalParagraphBlock[];
  readonly createdAt: number;
}

export function mapJournalEntry(sp: SPNote, ctx: MappingContext): MapperResult<MappedJournalEntry> {
  const resolved = ctx.translate("member", sp.member);
  if (resolved === null) {
    return failed(`FK miss: member ${sp.member} not in translation table`);
  }

  if (sp.color !== undefined && sp.color !== null) {
    ctx.addWarning({
      entityType: "journal-entry",
      entityId: sp._id,
      message: "SP `color` field dropped (no Pluralscape equivalent)",
    });
  }
  if (sp.supportMarkdown !== undefined) {
    ctx.addWarning({
      entityType: "journal-entry",
      entityId: sp._id,
      message: "SP `supportMarkdown` dropped (imported as plain text)",
    });
  }

  const block: MappedJournalParagraphBlock = {
    type: "paragraph",
    content: sp.note,
    children: [],
  };
  const payload: MappedJournalEntry = {
    title: sp.title,
    author: { entityType: "member", entityId: resolved },
    blocks: [block],
    createdAt: sp.date,
  };
  return mapped(payload);
}
