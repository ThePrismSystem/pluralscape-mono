import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { logger } from "../../lib/logger.js";
import {
  LoginThrottledError,
  listSessions,
  loginAccount,
  logoutCurrentSession,
  registerAccount,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";
import { errorMapProcedure } from "../error-mapper.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { router } from "../trpc.js";

/** Default page size for session listing. */
const DEFAULT_SESSION_LIMIT = 25;

/** Maximum page size for session listing. */
const MAX_SESSION_LIMIT = 100;

const PlatformSchema = z.enum(["web", "mobile"]).optional().default("web");

export const authRouter = router({
  /**
   * Register a new account. Public — no session required.
   * Platform defaults to "web" since tRPC cannot read Hono headers.
   */
  register: errorMapProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(1),
        recoveryKeyBackupConfirmed: z.boolean(),
        accountType: z.string().optional(),
        platform: PlatformSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { platform, ...params } = input;
      const audit = ctx.createAudit(null);
      return registerAccount(ctx.db, params, platform, audit);
    }),

  /**
   * Login with email and password. Public — no session required.
   * Throws UNAUTHORIZED on invalid credentials, TOO_MANY_REQUESTS if throttled.
   */
  login: errorMapProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(1),
        platform: PlatformSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { platform, ...credentials } = input;
      const audit = ctx.createAudit(null);
      let result;
      try {
        result = await loginAccount(ctx.db, credentials, platform, audit, logger);
      } catch (err) {
        if (err instanceof LoginThrottledError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
      if (result === null) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      return result;
    }),

  /** Logout the current session. Requires authentication. */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    await logoutCurrentSession(ctx.db, ctx.auth.sessionId, ctx.auth.accountId, audit);
    return { success: true as const };
  }),

  /** List active sessions for the authenticated account. */
  listSessions: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_SESSION_LIMIT)
          .optional()
          .default(DEFAULT_SESSION_LIMIT),
      }),
    )
    .query(async ({ input, ctx }) => {
      return listSessions(ctx.db, ctx.auth.accountId, input.cursor, input.limit);
    }),

  /**
   * Revoke a specific session by ID.
   * Throws BAD_REQUEST if caller tries to revoke their own current session.
   * Throws NOT_FOUND if the session does not exist or is already revoked.
   */
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (input.sessionId === ctx.auth.sessionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use logout to revoke the current session",
        });
      }
      const audit = ctx.createAudit(ctx.auth);
      const revoked = await revokeSession(ctx.db, input.sessionId, ctx.auth.accountId, audit);
      if (!revoked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or already revoked",
        });
      }
      return { revoked: true as const };
    }),

  /** Revoke all sessions except the current one. */
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    const count = await revokeAllSessions(ctx.db, ctx.auth.accountId, ctx.auth.sessionId, audit);
    return { revoked: count };
  }),
});
