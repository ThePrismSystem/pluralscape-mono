import {
  PWHASH_SALT_BYTES,
  TRANSFER_TIMEOUT_MS,
  assertPwhashSalt,
  decryptFromTransfer,
  deriveTransferKey,
} from "@pluralscape/crypto";
import { deviceTransferRequests } from "@pluralscape/db/pg";
import { createId, now } from "@pluralscape/types";
import { and, eq, gt } from "drizzle-orm";

import { deserializeEncryptedPayload } from "../lib/encrypted-payload.js";
import { fromHex, toHex } from "../lib/hex.js";
import { MAX_TRANSFER_CODE_ATTEMPTS } from "../routes/account/device-transfer.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AccountId, SessionId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Error types ────────────────────────────────────────────────────────

export class TransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferValidationError";
  }
}

export class TransferNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferNotFoundError";
  }
}

export class TransferCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferCodeError";
  }
}

export class TransferExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferExpiredError";
  }
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
  const codeSalt = fromHex(input.codeSaltHex);
  if (codeSalt.length !== PWHASH_SALT_BYTES) {
    throw new TransferValidationError(
      `codeSalt must be ${String(PWHASH_SALT_BYTES)} bytes, got ${String(codeSalt.length)}`,
    );
  }

  const encryptedKeyMaterial = fromHex(input.encryptedKeyMaterialHex);
  // Validate the encrypted payload can be deserialized (nonce + ciphertext)
  deserializeEncryptedPayload(encryptedKeyMaterial);

  const transferId = createId("dtr_");
  const createdAt = now();
  const expiresAt = (createdAt + TRANSFER_TIMEOUT_MS) as UnixMillis;

  await db.insert(deviceTransferRequests).values({
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

  await audit(db, {
    eventType: "auth.device-transfer-initiated",
    actor: { kind: "account", id: accountId },
    detail: `Transfer ${transferId} initiated`,
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
  const currentTime = now();

  const [row] = await db
    .select()
    .from(deviceTransferRequests)
    .where(
      and(
        eq(deviceTransferRequests.id, transferId),
        eq(deviceTransferRequests.accountId, accountId),
        eq(deviceTransferRequests.status, "pending"),
        gt(deviceTransferRequests.expiresAt, currentTime),
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

  // Derive the transfer key from the code and stored salt
  let codeValid = false;
  try {
    const transferKey = deriveTransferKey(code, salt);
    const payload = deserializeEncryptedPayload(row.encryptedKeyMaterial);
    // Attempt decryption to verify the code is correct
    decryptFromTransfer(payload, transferKey);
    codeValid = true;
  } catch {
    // Decryption failed — wrong code
  }

  if (!codeValid) {
    const newAttempts = row.codeAttempts + 1;
    if (newAttempts >= MAX_TRANSFER_CODE_ATTEMPTS) {
      // Lock out the transfer
      await db
        .update(deviceTransferRequests)
        .set({ status: "expired", codeAttempts: newAttempts })
        .where(eq(deviceTransferRequests.id, transferId));
      throw new TransferExpiredError("Too many incorrect attempts, transfer expired");
    }
    await db
      .update(deviceTransferRequests)
      .set({ codeAttempts: newAttempts })
      .where(eq(deviceTransferRequests.id, transferId));
    throw new TransferCodeError("Incorrect transfer code");
  }

  // Success: mark approved and set target session
  await db
    .update(deviceTransferRequests)
    .set({ status: "approved", targetSessionId: sessionId })
    .where(eq(deviceTransferRequests.id, transferId));

  await audit(db, {
    eventType: "auth.device-transfer-completed",
    actor: { kind: "account", id: accountId },
    detail: `Transfer ${transferId} completed`,
  });

  return { encryptedKeyMaterialHex: toHex(row.encryptedKeyMaterial) };
}
