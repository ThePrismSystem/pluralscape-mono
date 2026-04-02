import {
  CastVoteBodySchema,
  CreatePollBodySchema,
  UpdatePollBodySchema,
  UpdatePollVoteBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  castVote,
  deletePollVote,
  getPollResults,
  listVotes,
  updatePollVote,
} from "../../services/poll-vote.service.js";
import {
  archivePoll,
  closePoll,
  createPoll,
  deletePoll,
  getPoll,
  listPolls,
  restorePoll,
  updatePoll,
} from "../../services/poll.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for poll list queries. */
const MAX_LIST_LIMIT = 100;

const PollIdSchema = z.object({
  pollId: brandedIdQueryParam("poll_"),
});

const VoteIdSchema = z.object({
  pollId: brandedIdQueryParam("poll_"),
  voteId: brandedIdQueryParam("pv_"),
});

export const pollRouter = router({
  // ── Poll procedures ───────────────────────────────────────────────

  create: systemProcedure.input(CreatePollBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createPoll(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(PollIdSchema).query(async ({ ctx, input }) => {
    return getPoll(ctx.db, ctx.systemId, input.pollId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        status: z.enum(["open", "closed"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listPolls(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
        status: input.status,
      });
    }),

  update: systemProcedure
    .input(PollIdSchema.and(UpdatePollBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updatePoll(
        ctx.db,
        ctx.systemId,
        input.pollId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  close: systemProcedure.input(PollIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return closePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
  }),

  archive: systemProcedure.input(PollIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archivePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(PollIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restorePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(PollIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deletePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Poll vote procedures ──────────────────────────────────────────

  castVote: systemProcedure
    .input(PollIdSchema.and(CastVoteBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return castVote(ctx.db, ctx.systemId, input.pollId, input, ctx.auth, audit);
    }),

  listVotes: systemProcedure
    .input(
      PollIdSchema.and(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listVotes(ctx.db, ctx.systemId, input.pollId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  updateVote: systemProcedure
    .input(VoteIdSchema.and(UpdatePollVoteBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updatePollVote(
        ctx.db,
        ctx.systemId,
        input.pollId,
        input.voteId,
        input,
        ctx.auth,
        audit,
      );
    }),

  deleteVote: systemProcedure.input(VoteIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deletePollVote(ctx.db, ctx.systemId, input.pollId, input.voteId, ctx.auth, audit);
    return { success: true as const };
  }),

  results: systemProcedure.input(PollIdSchema).query(async ({ ctx, input }) => {
    return getPollResults(ctx.db, ctx.systemId, input.pollId, ctx.auth);
  }),
});
