import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { derivePasswordKey, generateMasterKey, unwrapMasterKey } from "../master-key-wrap.js";
import { resetPasswordViaRecoveryKey } from "../password-reset.js";
import { serializeRecoveryBackup } from "../recovery-backup.js";
import { recoverMasterKey } from "../recovery.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { RecoveryKeyDisplay } from "@pluralscape/types";

beforeAll(setupSodium);
afterAll(teardownSodium);

/** Build a valid encryptedBackup blob from a masterKey for use in tests. */
async function makeBackup(masterKey: ReturnType<typeof generateMasterKey>) {
  const { generateRecoveryKey } = await import("../recovery.js");
  const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
  const encryptedBackup = serializeRecoveryBackup(encryptedMasterKey);
  return { displayKey, encryptedBackup };
}

describe("resetPasswordViaRecoveryKey", () => {
  it("full round-trip: recovered masterKey matches original", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await resetPasswordViaRecoveryKey({
      displayKey,
      encryptedBackup,
      newPassword: "new-secure-password",
      pwhashProfile: "mobile",
    });

    expect(result.masterKey).toEqual(masterKey);
  });

  it("new password key correctly wraps the MasterKey (can unwrap with new password)", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await resetPasswordViaRecoveryKey({
      displayKey,
      encryptedBackup,
      newPassword: "wrap-verify-password",
      pwhashProfile: "mobile",
    });

    const newPasswordKey = await derivePasswordKey(
      "wrap-verify-password",
      result.newSalt,
      "mobile",
    );
    const unwrapped = unwrapMasterKey(result.wrappedMasterKey, newPasswordKey);
    expect(unwrapped).toEqual(masterKey);
  });

  it("new recovery backup is valid (different display key, same masterKey)", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await resetPasswordViaRecoveryKey({
      displayKey,
      encryptedBackup,
      newPassword: "recovery-backup-test",
      pwhashProfile: "mobile",
    });

    // The new recovery key should be different
    expect(result.newRecoveryKey.displayKey).not.toBe(displayKey);

    // But it must encrypt the same MasterKey
    const recoveredFromNew = recoverMasterKey(
      result.newRecoveryKey.displayKey,
      result.newRecoveryKey.encryptedMasterKey,
    );
    expect(recoveredFromNew).toEqual(masterKey);
  });

  it("invalid recovery key format throws InvalidInputError", async () => {
    const masterKey = generateMasterKey();
    const { encryptedBackup } = await makeBackup(masterKey);

    await expect(
      resetPasswordViaRecoveryKey({
        displayKey: "not-a-valid-key" as RecoveryKeyDisplay,
        encryptedBackup,
        newPassword: "new-password",
        pwhashProfile: "mobile",
      }),
    ).rejects.toThrow(InvalidInputError);
  });

  it("wrong recovery key throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const { encryptedBackup } = await makeBackup(masterKey);

    // Generate a different (valid-format) recovery key
    const { generateRecoveryKey } = await import("../recovery.js");
    const wrongKey = generateMasterKey();
    const { displayKey: wrongDisplayKey } = generateRecoveryKey(wrongKey);

    await expect(
      resetPasswordViaRecoveryKey({
        displayKey: wrongDisplayKey,
        encryptedBackup,
        newPassword: "new-password",
        pwhashProfile: "mobile",
      }),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("empty new password throws InvalidInputError", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    await expect(
      resetPasswordViaRecoveryKey({
        displayKey,
        encryptedBackup,
        newPassword: "",
        pwhashProfile: "mobile",
      }),
    ).rejects.toThrow(InvalidInputError);
  });

  it("tampered backup throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const tampered = new Uint8Array(encryptedBackup);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    await expect(
      resetPasswordViaRecoveryKey({
        displayKey,
        encryptedBackup: tampered,
        newPassword: "test",
        pwhashProfile: "mobile",
      }),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("memzeros the intermediate password key", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");

    await resetPasswordViaRecoveryKey({
      displayKey,
      encryptedBackup,
      newPassword: "memzero-test",
      pwhashProfile: "mobile",
    });

    // memzero called at least once (password key + recovery key bytes from recoverMasterKey)
    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});
