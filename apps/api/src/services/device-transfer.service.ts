import {
  DecryptionFailedError,
  PWHASH_SALT_BYTES,
  TRANSFER_TIMEOUT_MS,
  assertAeadKey,
  assertPwhashSalt,
  decryptFromTransfer,
  isValidTransferCode,
} from "@pluralscape/crypto";
import { deviceTransferRequests } from "@pluralscape/db/pg";
import { createId, now, toUnixMillis } from "@pluralscape/types";
import { and, eq, gt, sql } from "drizzle-orm";

import { deserializeEncryptedPayload } from "../lib/encrypted-payload.js";
import { fromHex, toHex } from "../lib/hex.js";
import { WorkerError, deriveTransferKeyOffload } from "../lib/pwhash-offload.js";
import { MAX_TRANSFER_CODE_ATTEMPTS } from "../routes/account/device-transfer.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AccountId, SessionId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Error types ────────────────────────────────────────────────────────

export class TransferValidationError extends Error {
  override readonly name = "TransferValidationError" as const;
}

export class TransferNotFoundError extends Error {
  override readonly name = "TransferNotFoundError" as const;
}

export class TransferCodeError extends Error {
  override readonly name = "TransferCodeError" as const;
}

export class TransferExpiredError extends Error {
  override readonly name = "TransferExpiredError" as const;
}

/** Thrown when the Argon2id worker pool is unavailable and key derivation cannot proceed. */
export class KeyDerivationUnavailableError extends Error {
  override readonly name = "KeyDerivationUnavailableError" as const;
}

// ── Initiate transfer ────────────────────────────────────────────────

interface InitiateTransferInput {
  readonly codeSaltHex: string;
  readonly encryptedKeyMaterialHex: string;
}

interface InitiateTransferResult {
  readonly transferId: string;
  readonly expiresAt: UnixMillis;
}

/**
 * Initiate a device transfer by creating a pending transfer request.
 *
 * The source device supplies the code salt (used with Argon2id to derive
 * the transfer key) and the encrypted key material (master key encrypted
 * under the transfer key). Both are hex-encoded.
 */
export async function initiateTransfer(
  db: PostgresJsDatabase,
  accountId: AccountId,
  sessionId: SessionId,
  input: InitiateTransferInput,
  audit: AuditWriter,
): Promise<InitiateTransferResult> {
  let codeSalt: Uint8Array;
  let encryptedKeyMaterial: Uint8Array;
  try {
    codeSalt = fromHex(input.codeSaltHex);
    if (codeSalt.length !== PWHASH_SALT_BYTES) {
      throw new TransferValidationError("Invalid code salt length");
    }
    encryptedKeyMaterial = fromHex(input.encryptedKeyMaterialHex);
    // Validate the encrypted payload can be deserialized (nonce + ciphertext)
    deserializeEncryptedPayload(encryptedKeyMaterial);
  } catch (error) {
    if (error instanceof TransferValidationError) throw error;
    throw new TransferValidationError("Invalid input format", { cause: error });
  }

  const transferId = createId("dtr_");
  const createdAt = now();
  // Security: expired transfer records retain their encrypted key material in
  // the DB until completeTransfer's WHERE clause filters them out by expiresAt.
  // A periodic cleanup job (or shorter TTL with eager wipe) is a future
  // optimization — the risk is minimal since the key material is encrypted
  // under the Argon2id-derived transfer key, which is never stored.
  const expiresAt = toUnixMillis(createdAt + TRANSFER_TIMEOUT_MS);

  await db.transaction(async (tx) => {
    await tx.insert(deviceTransferRequests).values({
      id: transferId,
      accountId,
      sourceSessionId: sessionId,
      targetSessionId: null,
      status: "pending",
      encryptedKeyMaterial,
      codeSalt,
      codeAttempts: 0,
      createdAt,
      expiresAt,
    });

    await audit(tx, {
      eventType: "auth.device-transfer-initiated",
      actor: { kind: "account", id: accountId },
      detail: `Transfer ${transferId} initiated`,
    });
  });

  return { transferId, expiresAt };
}

// ── Complete transfer ─────────────────────────────────────────────────

interface CompleteTransferResult {
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
  transferId: string,
  accountId: AccountId,
  sessionId: SessionId,
  code: string,
  audit: AuditWriter,
): Promise<CompleteTransferResult> {
  // Validate code format early before any DB work
  if (!isValidTransferCode(code)) {
    throw new TransferValidationError("Invalid transfer code format");
  }

  // Select only the fields we need, use DB time for expiry comparison
  const [row] = await db
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
        eq(deviceTransferRequests.status, "pending"),
        gt(deviceTransferRequests.expiresAt, sql`now()`),
      ),
    )
    .limit(1);

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
  } catch (error) {
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
    // Atomic counter increment with status guard to prevent TOCTOU race
    const [updated] = await db
      .update(deviceTransferRequests)
      .set({ codeAttempts: sql`${deviceTransferRequests.codeAttempts} + 1` })
      .where(
        and(
          eq(deviceTransferRequests.id, transferId),
          eq(deviceTransferRequests.status, "pending"),
        ),
      )
      .returning({ codeAttempts: deviceTransferRequests.codeAttempts });

    if (!updated) {
      throw new TransferNotFoundError("Transfer expired");
    }

    if (updated.codeAttempts >= MAX_TRANSFER_CODE_ATTEMPTS) {
      await db
        .update(deviceTransferRequests)
        .set({ status: "expired" })
        .where(
          and(
            eq(deviceTransferRequests.id, transferId),
            eq(deviceTransferRequests.status, "pending"),
          ),
        );
      throw new TransferExpiredError("Too many incorrect attempts");
    }

    throw new TransferCodeError("Incorrect transfer code");
  }

  // Success: audit the completion, then delete the transfer record to prevent
  // offline brute-force attacks against the stored encrypted key material.
  const encryptedKeyMaterialHex = toHex(row.encryptedKeyMaterial);

  await db.transaction(async (tx) => {
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
