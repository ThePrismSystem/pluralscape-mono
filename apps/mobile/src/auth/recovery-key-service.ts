import {
  deserializeRecoveryBackup,
  generateRecoveryKey,
  recoverMasterKey,
  regenerateRecoveryKey,
  serializeRecoveryBackup,
  toRecoveryKeyDisplay,
} from "@pluralscape/crypto";

import type { KdfMasterKey, RecoveryKeyResult } from "@pluralscape/crypto";
import type { RecoveryKeyDisplay } from "@pluralscape/types";

export class RecoveryKeyService {
  generate(masterKey: KdfMasterKey): RecoveryKeyResult {
    return generateRecoveryKey(masterKey);
  }

  recover(displayKey: string, encryptedBackup: Uint8Array): KdfMasterKey {
    const payload = deserializeRecoveryBackup(encryptedBackup);
    return recoverMasterKey(toRecoveryKeyDisplay(displayKey), payload);
  }

  regenerate(masterKey: KdfMasterKey): {
    displayKey: RecoveryKeyDisplay;
    serializedBackup: Uint8Array;
  } {
    const result = regenerateRecoveryKey(masterKey);
    return {
      displayKey: result.newRecoveryKey.displayKey,
      serializedBackup: result.serializedBackup,
    };
  }

  serialize(result: RecoveryKeyResult): Uint8Array {
    return serializeRecoveryBackup(result.encryptedMasterKey);
  }
}
