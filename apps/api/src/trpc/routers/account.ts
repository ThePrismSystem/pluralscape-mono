import {
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  HEX_CHARS_PER_BYTE,
  PWHASH_SALT_BYTES,
  TRANSFER_TIMEOUT_MS,
} from "@pluralscape/crypto";
import { MS_PER_HOUR, brandId } from "@pluralscape/types";
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

import { requireSession } from "../../lib/auth-context.js";
import { getQueue } from "../../lib/queue.js";
import {
  MAX_TRANSFER_CODE_ATTEMPTS,
  TRANSFER_INITIATION_LIMIT,
} from "../../routes/account/device-transfer.constants.js";
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
import { approveTransfer } from "../../services/device-transfer/approve.js";
import { completeTransfer } from "../../services/device-transfer/complete.js";
import {
  KeyDerivationUnavailableError,
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferSessionMismatchError,
  TransferValidationError,
} from "../../services/device-transfer/errors.js";
import { initiateTransfer } from "../../services/device-transfer/initiate.js";
import { regenerateRecoveryKeyBackup } from "../../services/recovery-key/regenerate.js";
import { getRecoveryKeyStatus } from "../../services/recovery-key/status.js";
import { protectedProcedure } from "../middlewares/auth.js";
import {
  accountKeyExtractor,
  createTRPCCategoryRateLimiter,
  createTRPCRateLimiter,
} from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

import type { DeviceTransferRequestId } from "@pluralscape/types";

// ── Device transfer input validation ──────────────────────────────────────────
// Zod v4 mirror of device-transfer.schema.ts (v3). Constants derived from
// @pluralscape/crypto to stay in sync with the canonical values.

/** Salt length in hex chars. */
const CODE_SALT_HEX_LENGTH = PWHASH_SALT_BYTES * HEX_CHARS_PER_BYTE;

/** Minimum encrypted key material hex chars: nonce + AEAD tag. */
const MIN_ENCRYPTED_KEY_MATERIAL_HEX = (AEAD_NONCE_BYTES + AEAD_TAG_BYTES) * HEX_CHARS_PER_BYTE;

/** Maximum encrypted key material hex chars (1024 bytes). */
const MAX_ENCRYPTED_KEY_MATERIAL_BYTES = 1_024;
const MAX_ENCRYPTED_KEY_MATERIAL_HEX = MAX_ENCRYPTED_KEY_MATERIAL_BYTES * HEX_CHARS_PER_BYTE;

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

// ── Rate limiters (matching REST parity) ──────────────────────────────────────

const authLightLimiter = createTRPCCategoryRateLimiter("authLight");
const authHeavyLimiter = createTRPCCategoryRateLimiter("authHeavy");
const writeLimiter = createTRPCCategoryRateLimiter("write");
const auditQueryLimiter = createTRPCCategoryRateLimiter("auditQuery");

const initiateTransferLimiter = createTRPCRateLimiter({
  limit: TRANSFER_INITIATION_LIMIT,
  windowMs: MS_PER_HOUR,
  keyPrefix: "deviceTransfer:initiate",
  keyExtractor: accountKeyExtractor,
});

const approveTransferLimiter = createTRPCRateLimiter({
  limit: TRANSFER_INITIATION_LIMIT,
  windowMs: MS_PER_HOUR,
  keyPrefix: "deviceTransfer:approve",
  keyExtractor: accountKeyExtractor,
});

const completeTransferLimiter = createTRPCRateLimiter({
  limit: MAX_TRANSFER_CODE_ATTEMPTS,
  windowMs: TRANSFER_TIMEOUT_MS,
  keyPrefix: "deviceTransfer:complete",
  keyExtractor: (_ctx, input) => (input as { transferId: string }).transferId,
});

// ─────────────────────────────────────────────────────────────────────────────

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
        from: input.from ?? 0,
        to: input.to ?? now,
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

  /**
   * Initiate a device transfer. Generates a transfer record that another
   * device can complete by providing the transfer code.
   */
  initiateDeviceTransfer: protectedProcedure
    .use(initiateTransferLimiter)
    .input(initiateTransferInput)
    .mutation(async ({ ctx, input }) => {
      const session = requireSession(ctx.auth);
      const audit = ctx.createAudit(ctx.auth);
      try {
        return await initiateTransfer(ctx.db, ctx.auth.accountId, session.sessionId, input, audit);
      } catch (err) {
        if (err instanceof TransferValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
        }
        throw err;
      }
    }),

  /**
   * Approve a pending device transfer (source device only).
   * Throws NOT_FOUND if the transfer does not exist, FORBIDDEN if the session
   * does not match the source session.
   */
  approveDeviceTransfer: protectedProcedure
    .use(approveTransferLimiter)
    .input(z.object({ transferId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = requireSession(ctx.auth);
      const audit = ctx.createAudit(ctx.auth);
      try {
        await approveTransfer(
          ctx.db,
          brandId<DeviceTransferRequestId>(input.transferId),
          ctx.auth.accountId,
          session.sessionId,
          audit,
        );
        return { success: true as const };
      } catch (err) {
        if (err instanceof TransferNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message, cause: err });
        }
        if (err instanceof TransferSessionMismatchError) {
          throw new TRPCError({ code: "FORBIDDEN", message: err.message, cause: err });
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
    .use(completeTransferLimiter)
    .input(completeTransferInput)
    .mutation(async ({ ctx, input }) => {
      const session = requireSession(ctx.auth);
      const audit = ctx.createAudit(ctx.auth);
      try {
        return await completeTransfer(
          ctx.db,
          brandId<DeviceTransferRequestId>(input.transferId),
          ctx.auth.accountId,
          session.sessionId,
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
            code: "SERVICE_UNAVAILABLE",
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
});
