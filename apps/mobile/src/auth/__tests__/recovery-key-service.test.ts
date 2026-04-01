import {
  configureSodium,
  generateMasterKey,
  initSodium,
  isValidRecoveryKeyFormat,
  serializeRecoveryBackup,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { RecoveryKeyService } from "../recovery-key-service.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

describe("RecoveryKeyService", () => {
  it("generates a recovery key with correct display format", () => {
    const service = new RecoveryKeyService();
    const masterKey = generateMasterKey();
    const result = service.generate(masterKey);
    expect(isValidRecoveryKeyFormat(result.displayKey as string)).toBe(true);
  });

  it("display key has 13 groups of 4 chars separated by dashes", () => {
    const service = new RecoveryKeyService();
    const masterKey = generateMasterKey();
    const result = service.generate(masterKey);
    const parts = (result.displayKey as string).split("-");
    expect(parts).toHaveLength(13);
    for (const part of parts) {
      expect(part).toHaveLength(4);
    }
  });

  it("recovers the master key from display key and serialized backup", () => {
    const service = new RecoveryKeyService();
    const masterKey = generateMasterKey();
    const result = service.generate(masterKey);
    const serialized = serializeRecoveryBackup(result.encryptedMasterKey);
    const recovered = service.recover(result.displayKey as string, serialized);
    expect(recovered).toEqual(masterKey);
  });

  it("regenerate returns displayKey and serializedBackup", () => {
    const service = new RecoveryKeyService();
    const masterKey = generateMasterKey();
    const { displayKey, serializedBackup } = service.regenerate(masterKey);
    expect(isValidRecoveryKeyFormat(displayKey)).toBe(true);
    expect(serializedBackup).toBeInstanceOf(Uint8Array);
    expect(serializedBackup.length).toBeGreaterThan(0);
  });
});
