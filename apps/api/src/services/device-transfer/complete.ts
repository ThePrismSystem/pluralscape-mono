import {
  DecryptionFailedError,
  assertAeadKey,
  assertPwhashSalt,
  decryptFromTransfer,
  isValidTransferCode,
} from "@pluralscape/crypto";
import { deviceTransferRequests } from "@pluralscape/db/pg";
import { and, eq, gt, sql } from "drizzle-orm";

import { deserializeEncryptedPayload } from "../../lib/encrypted-payload.js";
import { toHex } from "../../lib/hex.js";
import { WorkerError, deriveTransferKeyOffload } from "../../lib/kdf-offload.js";
import { withAccountTransaction } from "../../lib/rls-context.js";
import { MAX_TRANSFER_CODE_ATTEMPTS } from "../../routes/account/device-transfer.constants.js";

import {
  KeyDerivationUnavailableError,
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferValidationError,
} from "./errors.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, DeviceTransferRequestId, SessionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface CompleteTransferResult {
  readonly encryptedKeyMaterialHex: string;
}

/**
 * Complete a device transfer by verifying the transfer code and returning
 * the encrypted key material.
 *
 * The target device provides the transfer code. We derive the transfer
 * key from the code and stored salt, then attempt to decrypt the stored
 * encrypted key material to verify correctness. On success, the raw
 * encrypted material (hex) is returned to the target device.
 */
export async function completeTransfer(
  db: PostgresJsDatabase,
  transferId: DeviceTransferRequestId,
  accountId: AccountId,
  sessionId: SessionId,
  code: string,
  audit: AuditWriter,
): Promise<CompleteTransferResult> {
  // Validate code format early before any DB work
  if (!isValidTransferCode(code)) {
    throw new TransferValidationError("Invalid transfer code format");
  }

  // Select only the fields we need, use DB time for expiry comparison.
  // completeTransfer is only valid once the source session has explicitly
  // approved the transfer via approveTransfer (status='approved'). Matching
  // 'pending' here would let a target device race around the approval step
  // and brute-force the code before the source device consents.
  const row = await withAccountTransaction(db, accountId, async (tx) => {
    const [result] = await tx
      .select({
        id: deviceTransferRequests.id,
        encryptedKeyMaterial: deviceTransferRequests.encryptedKeyMaterial,
        codeSalt: deviceTransferRequests.codeSalt,
        codeAttempts: deviceTransferRequests.codeAttempts,
      })
      .from(deviceTransferRequests)
      .where(
        and(
          eq(deviceTransferRequests.id, transferId),
          eq(deviceTransferRequests.accountId, accountId),
          eq(deviceTransferRequests.status, "approved"),
          gt(deviceTransferRequests.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return result ?? null;
  });

  if (!row) {
    throw new TransferNotFoundError("Transfer request not found or expired");
  }

  if (!row.encryptedKeyMaterial) {
    throw new TransferNotFoundError("Transfer request has no key material");
  }

  // Validate and narrow the salt to the PwhashSalt branded type
  const salt = row.codeSalt;
  assertPwhashSalt(salt);

  // Derive the transfer key from the code and stored salt (off main thread only)
  let codeCorrect = false;
  try {
    const raw = await deriveTransferKeyOffload(code, salt);
    assertAeadKey(raw);
    const payload = deserializeEncryptedPayload(row.encryptedKeyMaterial);
    decryptFromTransfer(payload, raw);
    codeCorrect = true;
  } catch (error: unknown) {
    if (error instanceof DecryptionFailedError) {
      // Decryption failed — wrong code, handled below
    } else if (error instanceof WorkerError) {
      throw new KeyDerivationUnavailableError("Key derivation service is temporarily unavailable", {
        cause: error,
      });
    } else {
      throw error;
    }
  }

  if (!codeCorrect) {
    // Atomic counter increment with status guard to prevent TOCTOU race.
    // Uses 'approved' because a completion attempt requires prior approval.
    const updated = await withAccountTransaction(db, accountId, async (tx) => {
      const [result] = await tx
        .update(deviceTransferRequests)
        .set({ codeAttempts: sql`${deviceTransferRequests.codeAttempts} + 1` })
        .where(
          and(
            eq(deviceTransferRequests.id, transferId),
            eq(deviceTransferRequests.status, "approved"),
          ),
        )
        .returning({ codeAttempts: deviceTransferRequests.codeAttempts });
      return result ?? null;
    });

    if (!updated) {
      throw new TransferNotFoundError("Transfer expired");
    }

    if (updated.codeAttempts >= MAX_TRANSFER_CODE_ATTEMPTS) {
      await withAccountTransaction(db, accountId, async (tx) => {
        await tx
          .update(deviceTransferRequests)
          .set({ status: "expired" })
          .where(
            and(
              eq(deviceTransferRequests.id, transferId),
              eq(deviceTransferRequests.status, "approved"),
            ),
          );
      });
      throw new TransferExpiredError("Too many incorrect attempts");
    }

    throw new TransferCodeError("Incorrect transfer code");
  }

  // Success: audit the completion, then delete the transfer record to prevent
  // offline brute-force attacks against the stored encrypted key material.
  const encryptedKeyMaterialHex = toHex(row.encryptedKeyMaterial);

  await withAccountTransaction(db, accountId, async (tx) => {
    await audit(tx, {
      eventType: "auth.device-transfer-completed",
      actor: { kind: "account", id: accountId },
      detail: `Transfer ${transferId} completed by session ${sessionId}`,
    });

    const [deleted] = await tx
      .delete(deviceTransferRequests)
      .where(eq(deviceTransferRequests.id, transferId))
      .returning({ id: deviceTransferRequests.id });

    if (!deleted) {
      throw new TransferNotFoundError("Transfer already completed");
    }
  });

  return { encryptedKeyMaterialHex };
}
