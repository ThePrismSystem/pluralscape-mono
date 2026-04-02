import { RedeemFriendCodeBodySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveFriendCode,
  generateFriendCode,
  listFriendCodes,
  redeemFriendCode,
} from "../../services/friend-code.service.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { router } from "../trpc.js";

import type { FriendCodeId } from "@pluralscape/types";

/** Maximum items per page for friend code list queries. */
const MAX_LIST_LIMIT = 100;

const FriendCodeIdSchema = z.object({
  codeId: brandedIdQueryParam("frc_"),
});

export const friendCodeRouter = router({
  /** Generate a new friend code for the authenticated account. */
  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    return generateFriendCode(ctx.db, ctx.auth.accountId, ctx.auth, audit);
  }),

  /** List active, non-expired friend codes for the authenticated account. */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listFriendCodes(ctx.db, ctx.auth.accountId, ctx.auth, input.cursor, input.limit);
    }),

  /** Redeem a friend code to create a bidirectional friend connection. */
  redeem: protectedProcedure.input(RedeemFriendCodeBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return redeemFriendCode(ctx.db, input.code, ctx.auth, audit);
  }),

  /** Archive (revoke) a friend code. */
  archive: protectedProcedure.input(FriendCodeIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveFriendCode(
      ctx.db,
      ctx.auth.accountId,
      input.codeId as FriendCodeId,
      ctx.auth,
      audit,
    );
    return { success: true as const };
  }),
});
