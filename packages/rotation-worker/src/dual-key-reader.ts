import { DecryptionFailedError, decrypt } from "@pluralscape/crypto";

import type { AeadKey, EncryptedPayload } from "@pluralscape/crypto";

/**
 * Decrypt a blob using the appropriate key based on keyVersion.
 * Fails closed on unknown version — throws rather than guessing.
 */
export function decryptWithDualKey(
  payload: EncryptedPayload,
  keyVersion: number,
  oldKey: AeadKey,
  oldKeyVersion: number,
  newKey: AeadKey,
  newKeyVersion: number,
): Uint8Array {
  if (keyVersion === oldKeyVersion) {
    return decrypt(payload, oldKey);
  }

  if (keyVersion === newKeyVersion) {
    return decrypt(payload, newKey);
  }

  throw new DecryptionFailedError(
    `Unknown key version ${String(keyVersion)} — expected ${String(oldKeyVersion)} or ${String(newKeyVersion)}`,
  );
}
