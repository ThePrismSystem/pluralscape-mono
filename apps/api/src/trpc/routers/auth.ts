import { brandedIdQueryParam } from "@pluralscape/validation";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { requireSession } from "../../lib/auth-context.js";
import { logger } from "../../lib/logger.js";
import {
  LoginThrottledError,
  commitRegistration,
  initiateRegistration,
  listSessions,
  loginAccount,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";
import {
  NoActiveRecoveryKeyError,
  resetPasswordWithRecoveryKey,
} from "../../services/recovery-key.service.js";
import { errorMapProcedure } from "../error-mapper.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

const authHeavyLimiter = createTRPCCategoryRateLimiter("authHeavy");
const authLightLimiter = createTRPCCategoryRateLimiter("authLight");

/** Default page size for session listing. */
const DEFAULT_SESSION_LIMIT = 25;

/** Maximum page size for session listing. */
const MAX_SESSION_LIMIT = 100;

const PlatformSchema = z.enum(["web", "mobile"]).optional().default("web");

export const authRouter = router({
  /**
   * Registration phase 1: create account shell, returns KDF salt + challenge nonce.
   * Public — no session required.
   */
  registrationInitiate: errorMapProcedure
    .use(authHeavyLimiter)
    .input(
      z.object({
        email: z.email(),
        accountType: z.enum(["system", "viewer"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return initiateRegistration(ctx.db, input);
    }),

  /**
   * Registration phase 2: commit encrypted blobs + auth key, creates session.
   * Public — no session required.
   * Platform defaults to "web" since tRPC cannot read Hono headers.
   */
  registrationCommit: errorMapProcedure
    .use(authHeavyLimiter)
    .input(
      z.object({
        accountId: z.string().min(1),
        authKey: z.string().min(1),
        encryptedMasterKey: z.string().min(1),
        encryptedSigningPrivateKey: z.string().min(1),
        encryptedEncryptionPrivateKey: z.string().min(1),
        publicSigningKey: z.string().min(1),
        publicEncryptionKey: z.string().min(1),
        recoveryEncryptedMasterKey: z.string().min(1),
        challengeSignature: z.string().min(1),
        recoveryKeyBackupConfirmed: z.boolean(),
        recoveryKeyHash: z.string().min(1),
        platform: PlatformSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { platform, ...params } = input;
      const audit = ctx.createAudit(null);
      return commitRegistration(ctx.db, params, platform, audit);
    }),

  /**
   * Login with email and password. Public — no session required.
   * Throws UNAUTHORIZED on invalid credentials, TOO_MANY_REQUESTS if throttled.
   */
  login: errorMapProcedure
    .use(authHeavyLimiter)
    .input(
      z.object({
        email: z.email(),
        authKey: z.string().min(1),
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

  /**
   * Reset password using a recovery key. Public — no session required.
   * Throws UNAUTHORIZED if email/recovery key combination is invalid.
   */
  resetPasswordWithRecoveryKey: errorMapProcedure
    .use(authHeavyLimiter)
    .input(
      z.object({
        email: z.email(),
        newAuthKey: z.string().min(1),
        newKdfSalt: z.string().min(1),
        newEncryptedMasterKey: z.string().min(1),
        newRecoveryEncryptedMasterKey: z.string().min(1),
        recoveryKeyHash: z.string().min(1),
        newRecoveryKeyHash: z.string().min(1),
        platform: PlatformSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { platform, ...params } = input;
      const audit = ctx.createAudit(null);
      let result;
      try {
        result = await resetPasswordWithRecoveryKey(ctx.db, params, platform, audit);
      } catch (err) {
        if (err instanceof NoActiveRecoveryKeyError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or recovery key",
            cause: err,
          });
        }
        throw err;
      }
      if (result === null) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or recovery key",
        });
      }
      return result;
    }),

  /** Logout the current session. Requires authentication. */
  logout: protectedProcedure.use(authLightLimiter).mutation(async ({ ctx }) => {
    const session = requireSession(ctx.auth);
    const audit = ctx.createAudit(ctx.auth);
    await logoutCurrentSession(ctx.db, session.sessionId, ctx.auth.accountId, audit);
    return { success: true as const };
  }),

  session: router({
    list: protectedProcedure
      .use(authLightLimiter)
      .input(
        z.object({
          cursor: z.string().nullish(),
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
        return listSessions(ctx.db, ctx.auth.accountId, input.cursor ?? undefined, input.limit);
      }),
    revoke: protectedProcedure
      .use(authLightLimiter)
      .input(z.object({ sessionId: brandedIdQueryParam("sess_") }))
      .mutation(async ({ input, ctx }) => {
        const session = requireSession(ctx.auth);
        if (input.sessionId === session.sessionId) {
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
    revokeAll: protectedProcedure.use(authLightLimiter).mutation(async ({ ctx }) => {
      const session = requireSession(ctx.auth);
      const audit = ctx.createAudit(ctx.auth);
      const count = await revokeAllSessions(ctx.db, ctx.auth.accountId, session.sessionId, audit);
      return { revokedCount: count };
    }),
  }),
});
