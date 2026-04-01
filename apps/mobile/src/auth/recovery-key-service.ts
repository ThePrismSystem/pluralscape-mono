import {
  deserializeRecoveryBackup,
  generateRecoveryKey,
  recoverMasterKey,
  regenerateRecoveryKey,
  serializeRecoveryBackup,
  toRecoveryKeyDisplay,
} from "@pluralscape/crypto";

import type { KdfMasterKey, RecoveryKeyResult } from "@pluralscape/crypto";

export class RecoveryKeyService {
  generate(masterKey: KdfMasterKey): RecoveryKeyResult {
    return generateRecoveryKey(masterKey);
  }

  recover(displayKey: string, encryptedBackup: Uint8Array): KdfMasterKey {
    const payload = deserializeRecoveryBackup(encryptedBackup);
    return recoverMasterKey(toRecoveryKeyDisplay(displayKey), payload);
  }

  regenerate(masterKey: KdfMasterKey): { displayKey: string; serializedBackup: Uint8Array } {
    const result = regenerateRecoveryKey(masterKey);
    return {
      displayKey: result.newRecoveryKey.displayKey as string,
      serializedBackup: result.serializedBackup,
    };
  }

  serialize(result: RecoveryKeyResult): Uint8Array {
    return serializeRecoveryBackup(result.encryptedMasterKey);
  }
}
