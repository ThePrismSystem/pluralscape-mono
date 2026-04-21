import {
  CastVoteBodySchema,
  CreatePollBodySchema,
  UpdatePollBodySchema,
  UpdatePollVoteBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { tracked } from "@trpc/server";
import { z } from "zod/v4";

import { publishEntityChange, subscribeToEntityChanges } from "../../lib/entity-pubsub.js";
import { archivePoll } from "../../services/poll/archive.js";
import { closePoll } from "../../services/poll/close.js";
import { createPoll } from "../../services/poll/create.js";
import { deletePoll } from "../../services/poll/delete.js";
import { getPoll } from "../../services/poll/get.js";
import { listPolls } from "../../services/poll/list.js";
import { restorePoll } from "../../services/poll/restore.js";
import { updatePoll } from "../../services/poll/update.js";
import { deletePollVote } from "../../services/poll/votes/archive.js";
import { castVote } from "../../services/poll/votes/cast.js";
import { listVotes } from "../../services/poll/votes/list.js";
import { getPollResults } from "../../services/poll/votes/results.js";
import { updatePollVote } from "../../services/poll/votes/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { PollChangeEvent } from "@pluralscape/types";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

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

  create: systemProcedure
    .use(writeLimiter)
    .input(CreatePollBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await createPoll(ctx.db, ctx.systemId, input, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "created",
        pollId: result.id,
      });
      return result;
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(PollIdSchema)
    .query(async ({ ctx, input }) => {
      return getPoll(ctx.db, ctx.systemId, input.pollId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        status: z.enum(["open", "closed"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listPolls(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
        status: input.status,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema.and(UpdatePollBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await updatePoll(
        ctx.db,
        ctx.systemId,
        input.pollId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "updated",
        pollId: input.pollId,
      });
      return result;
    }),

  close: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await closePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "closed",
        pollId: input.pollId,
      });
      return result;
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archivePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "archived",
        pollId: input.pollId,
      });
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await restorePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "updated",
        pollId: input.pollId,
      });
      return result;
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deletePoll(ctx.db, ctx.systemId, input.pollId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "deleted",
        pollId: input.pollId,
      });
      return { success: true as const };
    }),

  // ── Poll vote procedures ──────────────────────────────────────────

  castVote: systemProcedure
    .use(writeLimiter)
    .input(PollIdSchema.and(CastVoteBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await castVote(ctx.db, ctx.systemId, input.pollId, input, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "voteCast",
        pollId: input.pollId,
      });
      return result;
    }),

  listVotes: systemProcedure
    .use(readLimiter)
    .input(
      PollIdSchema.and(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listVotes(ctx.db, ctx.systemId, input.pollId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  updateVote: systemProcedure
    .use(writeLimiter)
    .input(VoteIdSchema.and(UpdatePollVoteBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await updatePollVote(
        ctx.db,
        ctx.systemId,
        input.pollId,
        input.voteId,
        input,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "voteCast",
        pollId: input.pollId,
      });
      return result;
    }),

  deleteVote: systemProcedure
    .use(writeLimiter)
    .input(VoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deletePollVote(ctx.db, ctx.systemId, input.pollId, input.voteId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "poll",
        type: "voteCast",
        pollId: input.pollId,
      });
      return { success: true as const };
    }),

  results: systemProcedure
    .use(readLimiter)
    .input(PollIdSchema)
    .query(async ({ ctx, input }) => {
      return getPollResults(ctx.db, ctx.systemId, input.pollId, ctx.auth);
    }),

  onChange: systemProcedure
    .input(z.object({ pollId: brandedIdQueryParam("poll_").optional() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const filterPollId = input.pollId;
      const queue: PollChangeEvent[] = [];
      let resolve: (() => void) | null = null;

      const unsubscribe = await subscribeToEntityChanges(ctx.systemId, "poll", (event) => {
        const pollEvent = event as PollChangeEvent;
        if (!filterPollId || pollEvent.pollId === filterPollId) {
          queue.push(pollEvent);
          resolve?.();
        }
      });

      try {
        while (!signal?.aborted) {
          while (queue.length > 0) {
            const event = queue.shift();
            if (event) {
              yield tracked(`${event.type}:${event.pollId}`, event);
            }
          }
          await new Promise<void>((r) => {
            resolve = r;
          });
          resolve = null;
        }
      } finally {
        await unsubscribe?.();
      }
    }),
});
