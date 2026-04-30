import { deriveAuthAndPasswordKeys } from "../../auth-key.js";
import { createBucketKeyCache } from "../../bucket-key-cache.js";
import { generateIdentityKeypair } from "../../identity.js";
import { generateMasterKey, wrapMasterKey } from "../../master-key-wrap.js";
import { getSodium } from "../../sodium.js";
import { validateKeyVersion } from "../../validation.js";
import { createWebKeyStorage } from "../../web-key-storage.js";

import type { KeyLifecycleConfig, KeyLifecycleDeps } from "../../lifecycle-types.js";
import type { EncryptedPayload } from "../../symmetric.js";
import type { PwhashSalt } from "../../types.js";

// Timer type declarations for test environment (lib: ES2022 excludes DOM/Node timer globals)
declare function setTimeout(callback: () => void, ms: number): number;
declare function clearTimeout(handle: number): void;

export const KEY_VERSION_1 = validateKeyVersion(1);

export const STANDARD_CONFIG: KeyLifecycleConfig = {
  inactivityTimeoutMs: 300_000, // 5min
  graceTimeoutMs: 60_000, // 60sec
  requireBiometric: true,
};

export const TEST_PASSWORD = "test-passw0rd!";

/** Create an encrypted master key blob for use with unlockWithPassword. */
export async function createWrappedMasterKey(
  password: string,
  salt: PwhashSalt,
): Promise<EncryptedPayload> {
  const masterKey = generateMasterKey();
  const passwordBytes = new TextEncoder().encode(password);
  const { passwordKey } = await deriveAuthAndPasswordKeys(passwordBytes, salt);
  const wrapped = wrapMasterKey(masterKey, passwordKey);
  getSodium().memzero(passwordKey);
  return wrapped;
}

export function makeDeps(overrides?: Partial<KeyLifecycleDeps>): KeyLifecycleDeps {
  return {
    storage: createWebKeyStorage(),
    bucketKeyCache: createBucketKeyCache(),
    sodium: getSodium(),
    config: STANDARD_CONFIG,
    clock: {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (handle: number | object) => {
        clearTimeout(handle as number);
      },
    },
    deriveIdentityKeys: generateIdentityKeypair,
    ...overrides,
  };
}
