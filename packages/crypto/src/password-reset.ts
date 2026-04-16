import { deriveAuthAndPasswordKeys } from "./auth-key.js";
import { wrapMasterKey } from "./master-key-wrap.js";
import { generateSalt } from "./master-key.js";
import { deserializeRecoveryBackup } from "./recovery-backup.js";
import { generateRecoveryKey, recoverMasterKey } from "./recovery.js";
import { getSodium } from "./sodium.js";

import type { RecoveryKeyResult } from "./recovery.js";
import type { EncryptedPayload } from "./symmetric.js";
import type { AuthKey, KdfMasterKey, PwhashSalt } from "./types.js";
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
  /** The recovered MasterKey — unchanged from before the reset. @mustZero */
  readonly masterKey: KdfMasterKey;
  /** New salt generated for the new password. */
  readonly newSalt: PwhashSalt;
  /** MasterKey re-wrapped under the new password key — store in accounts.encrypted_master_key. */
  readonly wrappedMasterKey: EncryptedPayload;
  /** Fresh recovery key — the old one was consumed and must be replaced. */
  readonly newRecoveryKey: RecoveryKeyResult;
  /** Auth key for server-side verification — zeroed automatically after callback completes. */
  readonly authKey: AuthKey;
}

/**
 * Reset a password using a recovery key, with automatic authKey zeroing.
 *
 * The callback receives the full result including the raw authKey. When the
 * callback completes (or throws), the authKey is zeroed in a `finally` block.
 * This prevents callers from forgetting to clean up sensitive key material.
 */
export async function withPasswordResetResult<T>(
  params: PasswordResetParams,
  fn: (result: PasswordResetResult) => Promise<T>,
): Promise<T> {
  const result = await resetPasswordViaRecoveryKeyInternal(params);
  try {
    return await fn(result);
  } finally {
    getSodium().memzero(result.authKey);
  }
}

/**
 * Reset a password using a recovery key, with automatic masterKey and authKey zeroing.
 *
 * The callback receives the full result including the raw masterKey and authKey.
 * When the callback completes (or throws), both masterKey and authKey are zeroed
 * in a `finally` block. This prevents callers from forgetting to clean up
 * sensitive key material.
 */
export async function withMasterKeyFromReset<T>(
  params: PasswordResetParams,
  fn: (result: PasswordResetResult) => Promise<T>,
): Promise<T> {
  const result = await resetPasswordViaRecoveryKeyInternal(params);
  try {
    return await fn(result);
  } finally {
    getSodium().memzero(result.masterKey);
    getSodium().memzero(result.authKey);
  }
}

async function resetPasswordViaRecoveryKeyInternal(
  params: PasswordResetParams,
): Promise<PasswordResetResult> {
  const adapter = getSodium();
  const { displayKey, encryptedBackup, newPassword } = params;

  const payload = deserializeRecoveryBackup(encryptedBackup);
  const masterKey = recoverMasterKey(displayKey, payload);

  const newSalt = generateSalt();
  const passwordBytes = new TextEncoder().encode(newPassword);
  const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(
    passwordBytes,
    newSalt,
    newPassword.length,
  );
  try {
    const wrappedMasterKey = wrapMasterKey(masterKey, passwordKey);
    const newRecoveryKey = generateRecoveryKey(masterKey);
    return { masterKey, newSalt, wrappedMasterKey, newRecoveryKey, authKey };
  } finally {
    adapter.memzero(passwordKey);
    adapter.memzero(passwordBytes);
  }
}
