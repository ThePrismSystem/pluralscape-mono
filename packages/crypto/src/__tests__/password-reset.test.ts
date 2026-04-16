import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { deriveAuthAndPasswordKeys } from "../auth-key.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { generateMasterKey, unwrapMasterKey } from "../master-key-wrap.js";
import { withMasterKeyFromReset, withPasswordResetResult } from "../password-reset.js";
import { serializeRecoveryBackup } from "../recovery-backup.js";
import { recoverMasterKey } from "../recovery.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { PasswordResetResult } from "../password-reset.js";
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

/** Helper: run withPasswordResetResult and capture the result snapshot. */
async function captureResetResult(params: {
  displayKey: RecoveryKeyDisplay;
  encryptedBackup: Uint8Array;
  newPassword: string;
}): Promise<PasswordResetResult> {
  let captured: PasswordResetResult | undefined;
  await withPasswordResetResult(params, (result) => {
    // Snapshot the result — authKey will be zeroed after this callback returns
    captured = {
      masterKey: result.masterKey,
      newSalt: result.newSalt,
      wrappedMasterKey: result.wrappedMasterKey,
      newRecoveryKey: result.newRecoveryKey,
      authKey: new Uint8Array(result.authKey) as typeof result.authKey,
    };
    return Promise.resolve();
  });
  if (!captured) {
    throw new Error("withPasswordResetResult callback was not invoked");
  }
  return captured;
}

describe("withPasswordResetResult", () => {
  it("full round-trip: recovered masterKey matches original", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await captureResetResult({
      displayKey,
      encryptedBackup,
      newPassword: "new-secure-password",
    });

    expect(result.masterKey).toEqual(masterKey);
  });

  it("new password key correctly wraps the MasterKey (can unwrap with new password)", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await captureResetResult({
      displayKey,
      encryptedBackup,
      newPassword: "wrap-verify-password",
    });

    const passwordBytes = new TextEncoder().encode("wrap-verify-password");
    const { passwordKey: newPasswordKey } = await deriveAuthAndPasswordKeys(
      passwordBytes,
      result.newSalt,
    );
    const unwrapped = unwrapMasterKey(result.wrappedMasterKey, newPasswordKey);
    expect(unwrapped).toEqual(masterKey);
  });

  it("new recovery backup is valid (different display key, same masterKey)", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await captureResetResult({
      displayKey,
      encryptedBackup,
      newPassword: "recovery-backup-test",
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

  it("returns an authKey as a 32-byte Uint8Array", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    const result = await captureResetResult({
      displayKey,
      encryptedBackup,
      newPassword: "authkey-check-pw",
    });

    expect(result.authKey).toBeInstanceOf(Uint8Array);
    expect(result.authKey.length).toBe(32);
  });

  it("invalid recovery key format throws InvalidInputError", async () => {
    const masterKey = generateMasterKey();
    const { encryptedBackup } = await makeBackup(masterKey);

    await expect(
      withPasswordResetResult(
        {
          displayKey: "not-a-valid-key" as RecoveryKeyDisplay,
          encryptedBackup,
          newPassword: "new-password",
        },
        async () => {},
      ),
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
      withPasswordResetResult(
        {
          displayKey: wrongDisplayKey,
          encryptedBackup,
          newPassword: "new-password",
        },
        async () => {},
      ),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("empty new password throws InvalidInputError", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);

    await expect(
      withPasswordResetResult(
        {
          displayKey,
          encryptedBackup,
          newPassword: "",
        },
        async () => {},
      ),
    ).rejects.toThrow(InvalidInputError);
  });

  it("tampered backup throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const tampered = new Uint8Array(encryptedBackup);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    await expect(
      withPasswordResetResult(
        {
          displayKey,
          encryptedBackup: tampered,
          newPassword: "test",
        },
        async () => {},
      ),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("zeros the authKey after callback completes", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");

    await withPasswordResetResult(
      { displayKey, encryptedBackup, newPassword: "memzero-test-pw" },
      async () => {},
    );

    // memzero called for: passwordKey, passwordBytes, and authKey
    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});

describe("withMasterKeyFromReset", () => {
  it("provides masterKey to the callback and zeros both masterKey and authKey after", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");

    let receivedMasterKey: Uint8Array | undefined;
    const callbackResult = await withMasterKeyFromReset(
      { displayKey, encryptedBackup, newPassword: "zeroing-test-pw" },
      (result) => {
        receivedMasterKey = new Uint8Array(result.masterKey);
        expect(result.masterKey).toEqual(masterKey);
        return Promise.resolve("callback-value");
      },
    );

    expect(callbackResult).toBe("callback-value");
    expect(receivedMasterKey).toBeDefined();

    // masterKey and authKey should both have been zeroed
    const zeroedBuffers = memzeroSpy.mock.calls.map((call) => call[0]);
    // Find the masterKey buffer among zeroed buffers (32 bytes, was equal to original)
    const masterKeyZeroed = zeroedBuffers.some(
      (buf) => buf.length === masterKey.length && buf.every((b) => b === 0),
    );
    expect(masterKeyZeroed).toBe(true);

    memzeroSpy.mockRestore();
  });

  it("zeros masterKey and authKey even when the callback throws", async () => {
    const masterKey = generateMasterKey();
    const { displayKey, encryptedBackup } = await makeBackup(masterKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");

    await expect(
      withMasterKeyFromReset({ displayKey, encryptedBackup, newPassword: "throw-test-pw" }, () => {
        return Promise.reject(new Error("callback failure"));
      }),
    ).rejects.toThrow("callback failure");

    // memzero should still have been called for cleanup
    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});
