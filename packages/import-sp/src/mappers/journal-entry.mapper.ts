/**
 * Journal entry mapper.
 *
 * SP `notes` → Pluralscape journal entries (notes). The SP note body is plain
 * text which becomes the `encrypted.content` field. SP `color` maps to
 * `encrypted.backgroundColor`.
 *
 * `sp.supportMarkdown` has no Pluralscape equivalent and is dropped with a
 * warning so users can audit what was lost during import.
 *
 * Fails when the author FK can't be resolved.
 */
import { brandValue } from "@pluralscape/types";

import { parseHexColor } from "./helpers.js";
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPNote } from "../sources/sp-types.js";
import type { NoteContent, NoteEncryptedInput, NoteTitle } from "@pluralscape/types";
import type { CreateNoteBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedJournalEntry = Omit<z.infer<typeof CreateNoteBodySchema>, "encryptedData"> & {
  readonly encrypted: NoteEncryptedInput;
  readonly createdAt: number;
};

export function mapJournalEntry(sp: SPNote, ctx: MappingContext): MapperResult<MappedJournalEntry> {
  const resolved = ctx.translate("member", sp.member);
  if (resolved === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: member ${sp.member} not in translation table`,
      missingRefs: [sp.member],
      targetField: "member",
    });
  }

  if (sp.supportMarkdown !== undefined) {
    ctx.addWarningOnce("journal-entry.supportMarkdown-dropped", {
      entityType: "journal-entry",
      entityId: null,
      message: "SP `supportMarkdown` dropped (imported as plain text)",
    });
  }

  const backgroundColor = parseHexColor(sp.color);
  if (sp.color && backgroundColor === null) {
    ctx.addWarningOnce("invalid-hex-color:journal-entry", {
      entityType: "journal-entry",
      entityId: sp._id,
      message: `Invalid color "${sp.color}" dropped (not valid hex)`,
    });
  }

  const encrypted: NoteEncryptedInput = {
    title: brandValue<NoteTitle>(sp.title),
    content: brandValue<NoteContent>(sp.note),
    backgroundColor,
  };

  const payload: MappedJournalEntry = {
    encrypted,
    author: { entityType: "member" as const, entityId: resolved },
    createdAt: sp.date,
  };
  return mapped(payload);
}
