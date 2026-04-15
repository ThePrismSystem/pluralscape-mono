import { deriveAuthAndPasswordKeys } from "./auth-key.js";
import { wrapMasterKey } from "./master-key-wrap.js";
import { generateSalt } from "./master-key.js";
import { deserializeRecoveryBackup } from "./recovery-backup.js";
import { generateRecoveryKey, recoverMasterKey } from "./recovery.js";
import { getSodium } from "./sodium.js";

import type { RecoveryKeyResult } from "./recovery.js";
import type { EncryptedPayload } from "./symmetric.js";
import type { KdfMasterKey, PwhashSalt } from "./types.js";
import type { RecoveryKeyDisplay } from "@pluralscape/types";

/** Input for a password reset via recovery key. */
export interface PasswordResetParams {
  /** The recovery key display string from the user (e.g. ABCD-EFGH-...). */
  readonly displayKey: RecoveryKeyDisplay;
  /** Serialized encrypted backup blob retrieved from the server. */
  readonly encryptedBackup: Uint8Array;
  /** The new password to set. */
  readonly newPassword: string;
}

/** Result of a successful password reset via recovery key. */
export interface PasswordResetResult {
  /** The recovered MasterKey — unchanged from before the reset. */
  readonly masterKey: KdfMasterKey;
  /** New salt generated for the new password. */
  readonly newSalt: PwhashSalt;
  /** MasterKey re-wrapped under the new password key — store in accounts.encrypted_master_key. */
  readonly wrappedMasterKey: EncryptedPayload;
  /** Fresh recovery key — the old one was consumed and must be replaced. */
  readonly newRecoveryKey: RecoveryKeyResult;
  /** Auth key for server-side verification — send to server, never store. */
  readonly authKey: Uint8Array;
}

/**
 * Reset a password using a recovery key.
 *
 * Flow:
 * 1. Deserialize the encrypted backup blob from the server.
 * 2. Decrypt the MasterKey using the recovery key display string.
 * 3. Generate a new salt + derive split auth/password keys.
 * 4. Re-wrap the MasterKey under the new password key.
 * 5. Generate a new recovery key (the old one is consumed after use).
 *
 * The caller is responsible for persisting wrappedMasterKey, newSalt, and
 * the new recovery key backup to the server, and revoking the old recovery key.
 */
export async function resetPasswordViaRecoveryKey(
  params: PasswordResetParams,
): Promise<PasswordResetResult> {
  const adapter = getSodium();
  const { displayKey, encryptedBackup, newPassword } = params;

  const payload = deserializeRecoveryBackup(encryptedBackup);
  const masterKey = recoverMasterKey(displayKey, payload);

  const newSalt = generateSalt();
  const passwordBytes = new TextEncoder().encode(newPassword);
  const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, newSalt);
  try {
    const wrappedMasterKey = wrapMasterKey(masterKey, passwordKey);
    const newRecoveryKey = generateRecoveryKey(masterKey);
    return { masterKey, newSalt, wrappedMasterKey, newRecoveryKey, authKey };
  } finally {
    adapter.memzero(passwordKey);
  }
}
