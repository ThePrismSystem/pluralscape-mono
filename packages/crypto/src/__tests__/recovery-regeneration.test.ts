import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DecryptionFailedError } from "../errors.js";
import { generateMasterKey } from "../master-key-wrap.js";
import { deserializeRecoveryBackup } from "../recovery-backup.js";
import { regenerateRecoveryKey } from "../recovery-regeneration.js";
import { generateRecoveryKey, recoverMasterKey } from "../recovery.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("regenerateRecoveryKey", () => {
  it("returns a new display key different from a previous one", () => {
    const masterKey = generateMasterKey();
    const { displayKey: oldDisplayKey } = generateRecoveryKey(masterKey);
    const { newRecoveryKey } = regenerateRecoveryKey(masterKey);
    expect(newRecoveryKey.displayKey).not.toBe(oldDisplayKey);
  });

  it("both old and new key encrypt the same MasterKey", () => {
    const masterKey = generateMasterKey();
    const { displayKey: oldDisplayKey, encryptedMasterKey: oldEncrypted } =
      generateRecoveryKey(masterKey);
    const { newRecoveryKey } = regenerateRecoveryKey(masterKey);

    const recoveredFromOld = recoverMasterKey(oldDisplayKey, oldEncrypted);
    const recoveredFromNew = recoverMasterKey(
      newRecoveryKey.displayKey,
      newRecoveryKey.encryptedMasterKey,
    );
    expect(recoveredFromOld).toEqual(masterKey);
    expect(recoveredFromNew).toEqual(masterKey);
  });

  it("old recovery key cannot decrypt new backup (different encrypted payload)", () => {
    const masterKey = generateMasterKey();
    const { displayKey: oldDisplayKey } = generateRecoveryKey(masterKey);
    const { newRecoveryKey } = regenerateRecoveryKey(masterKey);

    // The old key cannot decrypt the new backup (different ciphertext + nonce)
    expect(() => recoverMasterKey(oldDisplayKey, newRecoveryKey.encryptedMasterKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("new recovery key decrypts new backup -> same MasterKey", () => {
    const masterKey = generateMasterKey();
    const { newRecoveryKey } = regenerateRecoveryKey(masterKey);
    const recovered = recoverMasterKey(
      newRecoveryKey.displayKey,
      newRecoveryKey.encryptedMasterKey,
    );
    expect(recovered).toEqual(masterKey);
  });

  it("serialized backup round-trips through deserialize", () => {
    const masterKey = generateMasterKey();
    const { newRecoveryKey, serializedBackup } = regenerateRecoveryKey(masterKey);
    const deserialized = deserializeRecoveryBackup(serializedBackup);
    const recovered = recoverMasterKey(newRecoveryKey.displayKey, deserialized);
    expect(recovered).toEqual(masterKey);
  });

  it("serializedBackup is a Uint8Array", () => {
    const masterKey = generateMasterKey();
    const { serializedBackup } = regenerateRecoveryKey(masterKey);
    expect(serializedBackup).toBeInstanceOf(Uint8Array);
  });

  it("two regenerations produce different keys", () => {
    const masterKey = generateMasterKey();
    const { newRecoveryKey: key1 } = regenerateRecoveryKey(masterKey);
    const { newRecoveryKey: key2 } = regenerateRecoveryKey(masterKey);
    expect(key1.displayKey).not.toBe(key2.displayKey);
  });
});
