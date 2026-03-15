import { serializeRecoveryBackup } from "./recovery-backup.js";
import { generateRecoveryKey } from "./recovery.js";

import type { RecoveryKeyResult } from "./recovery.js";
import type { KdfMasterKey } from "./types.js";

/** Result of regenerating a recovery key. */
export interface RegenerateResult {
  /** New recovery key (displayKey + encryptedMasterKey payload). */
  readonly newRecoveryKey: RecoveryKeyResult;
  /** Serialized backup blob ready for server storage. */
  readonly serializedBackup: Uint8Array;
}

/**
 * Generate a new recovery key from an authenticated session, replacing the old one.
 *
 * The atomic revocation of the old key and insertion of the new backup is handled
 * at the service layer via replaceRecoveryKeyBackup() — this function only
 * produces the new crypto material.
 *
 * The caller must:
 * 1. Store newRecoveryKey.displayKey securely (show to user once, never again).
 * 2. Upload serializedBackup to the server.
 * 3. Call replaceRecoveryKeyBackup() to atomically revoke the old key and store the new backup.
 */
export function regenerateRecoveryKey(masterKey: KdfMasterKey): RegenerateResult {
  const newRecoveryKey = generateRecoveryKey(masterKey);
  const serializedBackup = serializeRecoveryBackup(newRecoveryKey.encryptedMasterKey);
  return { newRecoveryKey, serializedBackup };
}
