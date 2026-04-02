import { NOTE_AUTHOR_ENTITY_TYPES } from "@pluralscape/types";
import {
  CreateNoteBodySchema,
  UpdateNoteBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveNote,
  createNote,
  deleteNote,
  getNote,
  listNotes,
  restoreNote,
  updateNote,
} from "../../services/note.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for note list queries. */
const MAX_LIST_LIMIT = 100;

const NoteIdSchema = z.object({
  noteId: brandedIdQueryParam("note_"),
});

export const noteRouter = router({
  create: systemProcedure.input(CreateNoteBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createNote(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(NoteIdSchema).query(async ({ ctx, input }) => {
    return getNote(ctx.db, ctx.systemId, input.noteId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        authorEntityType: z.enum(NOTE_AUTHOR_ENTITY_TYPES).optional(),
        authorEntityId: z.string().optional(),
        systemWide: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listNotes(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
        authorEntityType: input.authorEntityType,
        authorEntityId: input.authorEntityId,
        systemWide: input.systemWide,
      });
    }),

  update: systemProcedure
    .input(NoteIdSchema.and(UpdateNoteBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateNote(
        ctx.db,
        ctx.systemId,
        input.noteId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure.input(NoteIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(NoteIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(NoteIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
    return { success: true as const };
  }),
});
