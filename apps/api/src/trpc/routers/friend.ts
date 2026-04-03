import {
  FriendExportQuerySchema,
  UpdateFriendNotificationPreferenceBodySchema,
  UpdateFriendVisibilityBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  acceptFriendConnection,
  archiveFriendConnection,
  blockFriendConnection,
  getFriendConnection,
  listFriendConnections,
  rejectFriendConnection,
  removeFriendConnection,
  restoreFriendConnection,
  updateFriendVisibility,
} from "../../services/friend-connection.service.js";
import { getFriendDashboardSync } from "../../services/friend-dashboard-sync.service.js";
import { getFriendDashboard } from "../../services/friend-dashboard.service.js";
import {
  getFriendExportManifest,
  getFriendExportPage,
} from "../../services/friend-export.service.js";
import {
  getOrCreateFriendNotificationPreference,
  updateFriendNotificationPreference,
} from "../../services/friend-notification-preference.service.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for friend connection list queries. */
const MAX_LIST_LIMIT = 100;

/** Default items per page for friend connection list queries. */
const DEFAULT_LIST_LIMIT = 25;

const ConnectionIdSchema = z.object({
  connectionId: brandedIdQueryParam("fc_"),
});

export const friendRouter = router({
  /** List friend connections for the authenticated account. */
  list: protectedProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
        includeArchived: z.boolean().default(false),
        status: z.enum(["pending", "accepted", "blocked", "removed"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listFriendConnections(ctx.db, ctx.auth.accountId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
        status: input.status,
      });
    }),

  /** Get a single friend connection by ID. */
  get: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema)
    .query(async ({ ctx, input }) => {
      return getFriendConnection(ctx.db, ctx.auth.accountId, input.connectionId, ctx.auth);
    }),

  /** Accept a pending friend connection. */
  accept: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return acceptFriendConnection(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
        audit,
      );
    }),

  /** Reject a pending friend connection. */
  reject: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return rejectFriendConnection(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
        audit,
      );
    }),

  /** Block a friend connection. */
  block: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return blockFriendConnection(ctx.db, ctx.auth.accountId, input.connectionId, ctx.auth, audit);
    }),

  /** Remove a friend connection. */
  remove: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return removeFriendConnection(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
        audit,
      );
    }),

  /** Archive a friend connection (soft-hide without changing status). */
  archive: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveFriendConnection(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
        audit,
      );
      return { success: true as const };
    }),

  /** Restore an archived friend connection. */
  restore: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreFriendConnection(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
        audit,
      );
    }),

  /** Update the encrypted visibility data for a friend connection. */
  updateVisibility: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema.and(UpdateFriendVisibilityBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const { connectionId, ...body } = input;
      return updateFriendVisibility(
        ctx.db,
        ctx.auth.accountId,
        connectionId,
        body,
        ctx.auth,
        audit,
      );
    }),

  /** Get the friend dashboard for a connection (visible fronting, members, etc.). */
  getDashboard: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema)
    .query(async ({ ctx, input }) => {
      return getFriendDashboard(ctx.db, input.connectionId, ctx.auth);
    }),

  /** Get the sync snapshot for a friend dashboard connection. */
  getDashboardSync: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema)
    .query(async ({ ctx, input }) => {
      return getFriendDashboardSync(ctx.db, input.connectionId, ctx.auth);
    }),

  /** Get a paginated export page of a friend's data. */
  exportData: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema.and(FriendExportQuerySchema))
    .query(async ({ ctx, input }) => {
      const { connectionId, entityType, limit, cursor } = input;
      return getFriendExportPage(ctx.db, connectionId, ctx.auth, entityType, limit, cursor);
    }),

  /** Get the export manifest (entity counts + ETags) for a friend connection. */
  exportManifest: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema)
    .query(async ({ ctx, input }) => {
      return getFriendExportManifest(ctx.db, input.connectionId, ctx.auth);
    }),

  /** Get or create notification preferences for a friend connection. */
  getNotifications: protectedProcedure
    .use(readLimiter)
    .input(ConnectionIdSchema)
    .query(async ({ ctx, input }) => {
      return getOrCreateFriendNotificationPreference(
        ctx.db,
        ctx.auth.accountId,
        input.connectionId,
        ctx.auth,
      );
    }),

  /** Update notification preferences for a friend connection. */
  updateNotifications: protectedProcedure
    .use(writeLimiter)
    .input(ConnectionIdSchema.and(UpdateFriendNotificationPreferenceBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const { connectionId, ...body } = input;
      return updateFriendNotificationPreference(
        ctx.db,
        ctx.auth.accountId,
        connectionId,
        body,
        ctx.auth,
        audit,
      );
    }),
});
