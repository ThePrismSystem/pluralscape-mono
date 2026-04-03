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
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for note list queries. */
const MAX_LIST_LIMIT = 100;

/** Maximum length for author entity ID query parameter. */
const MAX_AUTHOR_ID_LENGTH = 256;

const NoteIdSchema = z.object({
  noteId: brandedIdQueryParam("note_"),
});

export const noteRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateNoteBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createNote(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(NoteIdSchema)
    .query(async ({ ctx, input }) => {
      return getNote(ctx.db, ctx.systemId, input.noteId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
          authorEntityType: z.enum(NOTE_AUTHOR_ENTITY_TYPES).optional(),
          authorEntityId: z.string().max(MAX_AUTHOR_ID_LENGTH).optional(),
          systemWide: z.boolean().optional(),
        })
        .refine((v) => v.authorEntityId === undefined || v.authorEntityType !== undefined, {
          message: "authorEntityId requires authorEntityType",
        })
        .refine(
          (v) =>
            !v.systemWide || (v.authorEntityType === undefined && v.authorEntityId === undefined),
          { message: "systemWide cannot be combined with authorEntityType or authorEntityId" },
        ),
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
    .use(writeLimiter)
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

  archive: systemProcedure
    .use(writeLimiter)
    .input(NoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(NoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(NoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteNote(ctx.db, ctx.systemId, input.noteId, ctx.auth, audit);
      return { success: true as const };
    }),
});
