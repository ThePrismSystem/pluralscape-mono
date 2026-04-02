import {
  AuditLogQuerySchema,
  BiometricEnrollBodySchema,
  BiometricVerifyBodySchema,
  ChangeEmailSchema,
  ChangePasswordSchema,
  RegenerateRecoveryKeySchema,
  RemovePinBodySchema,
  SetPinBodySchema,
  UpdateAccountSettingsSchema,
  VerifyPinBodySchema,
} from "@pluralscape/validation";
import { TRPCError } from "@trpc/server";

import {
  removeAccountPin,
  setAccountPin,
  verifyAccountPin,
} from "../../services/account-pin.service.js";
import {
  changeEmail,
  changePassword,
  getAccountInfo,
  updateAccountSettings,
} from "../../services/account.service.js";
import { queryAuditLog } from "../../services/audit-log-query.service.js";
import { enrollBiometric, verifyBiometric } from "../../services/biometric.service.js";
import {
  getRecoveryKeyStatus,
  regenerateRecoveryKeyBackup,
} from "../../services/recovery-key.service.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { router } from "../trpc.js";

export const accountRouter = router({
  /** Get current account info. */
  getInfo: protectedProcedure.query(async ({ ctx }) => {
    const info = await getAccountInfo(ctx.db, ctx.auth.accountId);
    if (!info) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    }
    return info;
  }),

  /** Change account email address. Requires current password. */
  changeEmail: protectedProcedure.input(ChangeEmailSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return changeEmail(ctx.db, ctx.auth.accountId, input, audit);
  }),

  /** Change account password. Revokes all active sessions. */
  changePassword: protectedProcedure
    .input(ChangePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return changePassword(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Update account-level settings (e.g. audit log IP tracking). */
  updateSettings: protectedProcedure
    .input(UpdateAccountSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateAccountSettings(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Set a PIN for the account's system. */
  setPin: protectedProcedure.input(SetPinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await setAccountPin(ctx.db, ctx.auth.accountId, input, audit);
    return { ok: true as const };
  }),

  /** Remove the PIN from the account's system. Requires current PIN. */
  removePin: protectedProcedure.input(RemovePinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await removeAccountPin(ctx.db, ctx.auth.accountId, input, audit);
    return { ok: true as const };
  }),

  /** Verify the account PIN without removing it. */
  verifyPin: protectedProcedure.input(VerifyPinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return verifyAccountPin(ctx.db, ctx.auth.accountId, input, audit);
  }),

  /** Enroll a biometric token for the current session. */
  enrollBiometric: protectedProcedure
    .input(BiometricEnrollBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return enrollBiometric(ctx.db, input, ctx.auth, audit);
    }),

  /** Verify a biometric token for the current session. */
  verifyBiometric: protectedProcedure
    .input(BiometricVerifyBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return verifyBiometric(ctx.db, input, ctx.auth, audit);
    }),

  /** Get recovery key status (whether an active key exists). */
  getRecoveryKeyStatus: protectedProcedure.query(async ({ ctx }) => {
    return getRecoveryKeyStatus(ctx.db, ctx.auth.accountId);
  }),

  /** Regenerate the recovery key backup. Requires current password. */
  regenerateRecoveryKey: protectedProcedure
    .input(RegenerateRecoveryKeySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return regenerateRecoveryKeyBackup(ctx.db, ctx.auth.accountId, input, audit);
    }),

  /** Query the audit log for the authenticated account. */
  queryAuditLog: protectedProcedure.input(AuditLogQuerySchema).query(async ({ ctx, input }) => {
    const now = Date.now();
    return queryAuditLog(ctx.db, ctx.auth.accountId, {
      eventType: input.event_type,
      resourceType: input.resource_type,
      from: input.from ?? 0,
      to: input.to ?? now,
      cursor: input.cursor,
      limit: input.limit,
    });
  }),
});
