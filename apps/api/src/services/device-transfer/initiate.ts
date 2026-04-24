import { PWHASH_SALT_BYTES, TRANSFER_TIMEOUT_MS } from "@pluralscape/crypto";
import { deviceTransferRequests } from "@pluralscape/db/pg";
import { brandId, createId, now, toUnixMillis } from "@pluralscape/types";

import { deserializeEncryptedPayload } from "../../lib/encrypted-payload.js";
import { fromHex } from "../../lib/hex.js";
import { withAccountTransaction } from "../../lib/rls-context.js";

import { TransferValidationError } from "./errors.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, DeviceTransferRequestId, SessionId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface InitiateTransferInput {
  readonly codeSaltHex: string;
  readonly encryptedKeyMaterialHex: string;
}

export interface InitiateTransferResult {
  readonly transferId: DeviceTransferRequestId;
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
  } catch (error: unknown) {
    if (error instanceof TransferValidationError) throw error;
    throw new TransferValidationError("Invalid input format", { cause: error });
  }

  const transferId = brandId<DeviceTransferRequestId>(createId("dtr_"));
  const createdAt = now();
  // Security: expired transfer records retain their encrypted key material in
  // the DB until completeTransfer's WHERE clause filters them out by expiresAt.
  // A periodic cleanup job (or shorter TTL with eager wipe) is a future
  // optimization — the risk is minimal since the key material is encrypted
  // under the Argon2id-derived transfer key, which is never stored.
  const expiresAt = toUnixMillis(createdAt + TRANSFER_TIMEOUT_MS);

  await withAccountTransaction(db, accountId, async (tx) => {
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
