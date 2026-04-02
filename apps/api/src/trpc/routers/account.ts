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
import { z } from "zod/v4";

import { deleteAccount } from "../../services/account-deletion.service.js";
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
  KeyDerivationUnavailableError,
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferValidationError,
  completeTransfer,
  initiateTransfer,
} from "../../services/device-transfer.service.js";
import {
  getRecoveryKeyStatus,
  regenerateRecoveryKeyBackup,
} from "../../services/recovery-key.service.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { router } from "../trpc.js";

// ── Device transfer input validation constants ────────────────────────────────
// Mirror of device-transfer.schema.ts (which uses zod v3; tRPC routers use v4).

/** Hex chars per byte. */
const HEX_CHARS_PER_BYTE = 2;

/** Salt length in hex chars (16 bytes x 2). */
const CODE_SALT_HEX_LENGTH = 32;

/** Minimum encrypted key material hex chars: nonce (24 B) + AEAD tag (16 B) = 40 B x 2. */
const MIN_ENCRYPTED_KEY_MATERIAL_HEX = 80;

/** Maximum encrypted key material hex chars: 1024 B x 2. */
const MAX_ENCRYPTED_KEY_MATERIAL_HEX = 2_048;

/** Transfer code digit count. */
const TRANSFER_CODE_DIGIT_COUNT = 10;

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

const initiateTransferInput = z.object({
  codeSaltHex: z
    .string()
    .length(
      CODE_SALT_HEX_LENGTH,
      `codeSaltHex must be exactly ${String(CODE_SALT_HEX_LENGTH)} hex characters`,
    )
    .regex(HEX_PATTERN, "codeSaltHex must be a valid hex string")
    .transform((v) => v.toLowerCase()),
  encryptedKeyMaterialHex: z
    .string()
    .min(
      MIN_ENCRYPTED_KEY_MATERIAL_HEX,
      `encryptedKeyMaterialHex must be at least ${String(MIN_ENCRYPTED_KEY_MATERIAL_HEX)} hex characters`,
    )
    .max(
      MAX_ENCRYPTED_KEY_MATERIAL_HEX,
      `encryptedKeyMaterialHex must be at most ${String(MAX_ENCRYPTED_KEY_MATERIAL_HEX)} hex characters`,
    )
    .regex(HEX_PATTERN, "encryptedKeyMaterialHex must be a valid hex string")
    .refine((v) => v.length % HEX_CHARS_PER_BYTE === 0, {
      message: "encryptedKeyMaterialHex must have even length (whole bytes)",
    })
    .transform((v) => v.toLowerCase()),
});

const completeTransferInput = z.object({
  transferId: z.string().min(1),
  code: z
    .string()
    .length(
      TRANSFER_CODE_DIGIT_COUNT,
      `code must be exactly ${String(TRANSFER_CODE_DIGIT_COUNT)} digits`,
    )
    .regex(/^\d+$/, "code must contain only decimal digits"),
});

// ─────────────────────────────────────────────────────────────────────────────

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
    return { success: true as const };
  }),

  /** Remove the PIN from the account's system. Requires current PIN. */
  removePin: protectedProcedure.input(RemovePinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await removeAccountPin(ctx.db, ctx.auth.accountId, input, audit);
    return { success: true as const };
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

  /**
   * Permanently delete the authenticated account and all associated data.
   * Requires password confirmation.
   */
  deleteAccount: protectedProcedure
    .input(DeleteAccountBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteAccount(ctx.db, input, ctx.auth, audit);
      return { success: true as const };
    }),

  /**
   * Initiate a device transfer. Generates a transfer record that another
   * device can complete by providing the transfer code.
   */
  initiateDeviceTransfer: protectedProcedure
    .input(initiateTransferInput)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      try {
        return await initiateTransfer(ctx.db, ctx.auth.accountId, ctx.auth.sessionId, input, audit);
      } catch (err) {
        if (err instanceof TransferValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
        }
        throw err;
      }
    }),

  /**
   * Complete a device transfer using a transfer ID and one-time code.
   * Throws NOT_FOUND if the transfer does not exist, UNAUTHORIZED if the code
   * is invalid or expired, SERVICE_UNAVAILABLE if key derivation is unavailable.
   */
  completeDeviceTransfer: protectedProcedure
    .input(completeTransferInput)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      try {
        return await completeTransfer(
          ctx.db,
          input.transferId,
          ctx.auth.accountId,
          ctx.auth.sessionId,
          input.code,
          audit,
        );
      } catch (err) {
        if (err instanceof TransferNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message, cause: err });
        }
        if (err instanceof TransferCodeError || err instanceof TransferExpiredError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: err.message, cause: err });
        }
        if (err instanceof TransferValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
        }
        if (err instanceof KeyDerivationUnavailableError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
});
