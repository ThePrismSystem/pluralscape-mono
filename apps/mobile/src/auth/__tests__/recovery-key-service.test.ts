import {
  configureSodium,
  deserializeRecoveryBackup,
  generateMasterKey,
  generateRecoveryKey,
  initSodium,
  isValidRecoveryKeyFormat,
  recoverMasterKey,
  regenerateRecoveryKey,
  serializeRecoveryBackup,
  toRecoveryKeyDisplay,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

describe("recovery-key functions from @pluralscape/crypto", () => {
  it("generates a recovery key with correct display format", () => {
    const masterKey = generateMasterKey();
    const result = generateRecoveryKey(masterKey);
    expect(isValidRecoveryKeyFormat(result.displayKey as string)).toBe(true);
  });

  it("display key has 13 groups of 4 chars separated by dashes", () => {
    const masterKey = generateMasterKey();
    const result = generateRecoveryKey(masterKey);
    const parts = (result.displayKey as string).split("-");
    expect(parts).toHaveLength(13);
    for (const part of parts) {
      expect(part).toHaveLength(4);
    }
  });

  it("recovers the master key from display key and serialized backup", () => {
    const masterKey = generateMasterKey();
    const result = generateRecoveryKey(masterKey);
    const serialized = serializeRecoveryBackup(result.encryptedMasterKey);
    const payload = deserializeRecoveryBackup(serialized);
    const recovered = recoverMasterKey(toRecoveryKeyDisplay(result.displayKey as string), payload);
    expect(recovered).toEqual(masterKey);
  });

  it("regenerate returns displayKey and serializedBackup", () => {
    const masterKey = generateMasterKey();
    const regenerated = regenerateRecoveryKey(masterKey);
    expect(isValidRecoveryKeyFormat(regenerated.newRecoveryKey.displayKey)).toBe(true);
    expect(regenerated.serializedBackup).toBeInstanceOf(Uint8Array);
    expect(regenerated.serializedBackup.length).toBeGreaterThan(0);
  });
});
