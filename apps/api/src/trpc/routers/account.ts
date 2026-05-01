import { toUnixMillis } from "@pluralscape/types";
import {
  AuditLogQuerySchema,
  BiometricEnrollBodySchema,
  BiometricVerifyBodySchema,
  ChangeEmailSchema,
  ChangePasswordSchema,
  DeleteAccountBodySchema,
  RegenerateRecoveryKeySchema,
  RemovePinBodySchema,
  SetPinBodySchema,
  UpdateAccountSettingsSchema,
  VerifyPinBodySchema,
} from "@pluralscape/validation";
import { TRPCError } from "@trpc/server";

import { getQueue } from "../../lib/queue.js";
import { enqueueAccountEmailChangedNotification } from "../../services/account/notifications.js";
import { getAccountInfo } from "../../services/account/queries.js";
import {
  changeEmail,
  changePassword,
  updateAccountSettings,
} from "../../services/account/update.js";
import { deleteAccount } from "../../services/account-deletion.service.js";
import {
  removeAccountPin,
  setAccountPin,
  verifyAccountPin,
} from "../../services/account-pin.service.js";
import { queryAuditLog } from "../../services/audit-log-query.service.js";
import { enrollBiometric, verifyBiometric } from "../../services/biometric.service.js";
import { regenerateRecoveryKeyBackup } from "../../services/recovery-key/regenerate.js";
import { getRecoveryKeyStatus } from "../../services/recovery-key/status.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

import { deviceTransferProcedures } from "./account/device-transfer.js";

// ── Rate limiters (matching REST parity) ──────────────────────────────────────

const authLightLimiter = createTRPCCategoryRateLimiter("authLight");
const authHeavyLimiter = createTRPCCategoryRateLimiter("authHeavy");
const writeLimiter = createTRPCCategoryRateLimiter("write");
const auditQueryLimiter = createTRPCCategoryRateLimiter("auditQuery");

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Account router — composes account management procedures with device-transfer
 * procedures. All procedures require authentication.
 */
export const accountRouter = router({
  /** Get current account info. */
  get: protectedProcedure.use(authLightLimiter).query(async ({ ctx }) => {
    const info = await getAccountInfo(ctx.db, ctx.auth.accountId);
    if (!info) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    }
    return info;
  }),

  /** Change account email address. Requires current password. */
  changeEmail: protectedProcedure
    .use(authHeavyLimiter)
    .input(ChangeEmailSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await changeEmail(ctx.db, ctx.auth.accountId, input, audit);

      if (result.kind === "changed") {
        // Fire-and-forget: notify the OLD address. The helper owns
        // queue-null/oldEmail-null short-circuiting, failure logging, and
        // audit-event persistence — we must NOT await or rethrow from it.
        void enqueueAccountEmailChangedNotification(getQueue(), audit, ctx.db, {
          accountId: ctx.auth.accountId,
          oldEmail: result.oldEmail,
          newEmail: result.newEmail,
          version: result.version,
          ipAddress: ctx.requestMeta.ipAddress,
        });
      }

      // Do not leak oldEmail/newEmail via the tRPC response — they are only
      // used internally for routing the notification.
      return { ok: true as const };
    }),

  /** Change account password. Revokes all active sessions. */
  changePassword: protectedProcedure
    .use(authHeavyLimiter)
    .input(ChangePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return changePassword(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Update account-level settings (e.g. audit log IP tracking). */
  updateSettings: protectedProcedure
    .use(writeLimiter)
    .input(UpdateAccountSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateAccountSettings(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Set a PIN for the account's system. */
  setPin: protectedProcedure
    .use(authHeavyLimiter)
    .input(SetPinBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await setAccountPin(ctx.db, ctx.auth.accountId, input, audit);
      return { success: true as const };
    }),

  /** Remove the PIN from the account's system. Requires current PIN. */
  removePin: protectedProcedure
    .use(authHeavyLimiter)
    .input(RemovePinBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await removeAccountPin(ctx.db, ctx.auth.accountId, input, audit);
      return { success: true as const };
    }),

  /** Verify the account PIN without removing it. */
  verifyPin: protectedProcedure
    .use(authHeavyLimiter)
    .input(VerifyPinBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return verifyAccountPin(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Enroll a biometric token for the current session. */
  enrollBiometric: protectedProcedure
    .use(authHeavyLimiter)
    .input(BiometricEnrollBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return enrollBiometric(ctx.db, input, ctx.auth, audit);
    }),

  /** Verify a biometric token for the current session. */
  verifyBiometric: protectedProcedure
    .use(authHeavyLimiter)
    .input(BiometricVerifyBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return verifyBiometric(ctx.db, input, ctx.auth, audit);
    }),

  /** Get recovery key status (whether an active key exists). */
  getRecoveryKeyStatus: protectedProcedure.use(authLightLimiter).query(async ({ ctx }) => {
    return getRecoveryKeyStatus(ctx.db, ctx.auth.accountId);
  }),

  /** Regenerate the recovery key backup. Requires current password. */
  regenerateRecoveryKey: protectedProcedure
    .use(authHeavyLimiter)
    .input(RegenerateRecoveryKeySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return regenerateRecoveryKeyBackup(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Query the audit log for the authenticated account. */
  queryAuditLog: protectedProcedure
    .use(auditQueryLimiter)
    .input(AuditLogQuerySchema)
    .query(async ({ ctx, input }) => {
      const now = Date.now();
      return queryAuditLog(ctx.db, ctx.auth.accountId, {
        eventType: input.event_type,
        resourceType: input.resource_type,
        from: toUnixMillis(input.from ?? 0),
        to: toUnixMillis(input.to ?? now),
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  /**
   * Permanently delete the authenticated account and all associated data.
   * Requires password confirmation.
   */
  deleteAccount: protectedProcedure
    .use(writeLimiter)
    .input(DeleteAccountBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteAccount(ctx.db, input, ctx.auth, audit);
      return { success: true as const };
    }),

  ...deviceTransferProcedures,
});
