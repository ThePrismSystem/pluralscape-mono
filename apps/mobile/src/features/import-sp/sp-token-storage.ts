import * as SecureStore from "expo-secure-store";

import { SP_TOKEN_KEY_PREFIX } from "./import-sp-mobile.constants.js";

import type { SystemId } from "@pluralscape/types";

/**
 * Per-system persistent storage for Simply Plural API tokens.
 *
 * Wraps `expo-secure-store` with a system-scoped key namespace so a device
 * hosting multiple systems can preserve each system's import credential
 * independently. All operations are async; errors from the underlying
 * keychain are propagated so callers (such as the `useStartImport` hook)
 * can surface them to the user.
 */
export interface SpTokenStorage {
  get(systemId: SystemId): Promise<string | null>;
  set(systemId: SystemId, token: string): Promise<void>;
  clear(systemId: SystemId): Promise<void>;
  hasToken(systemId: SystemId): Promise<boolean>;
}

function keyFor(systemId: SystemId): string {
  return `${SP_TOKEN_KEY_PREFIX}${systemId}`;
}

/**
 * Hardened SecureStore options applied to every SP token operation.
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` ensures that:
 *   - the token is unreadable while the device is locked
 *   - the Keychain / EncryptedSharedPreferences entry is excluded from
 *     iCloud Keychain sync and encrypted-backup restores on a different
 *     physical device (no migration off-device)
 *
 * Applied to read, write, and delete calls for parity: SecureStore binds
 * the accessibility class at write time, but passing the same options on
 * reads/deletes keeps intent obvious and avoids accidental downgrades if
 * the underlying platform ever exposes per-call overrides.
 */
const SP_TOKEN_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Creates an SP token storage backed by Expo SecureStore. */
export function createSpTokenStorage(): SpTokenStorage {
  return {
    async get(systemId: SystemId): Promise<string | null> {
      return SecureStore.getItemAsync(keyFor(systemId), SP_TOKEN_SECURE_STORE_OPTIONS);
    },

    async set(systemId: SystemId, token: string): Promise<void> {
      await SecureStore.setItemAsync(keyFor(systemId), token, SP_TOKEN_SECURE_STORE_OPTIONS);
    },

    async clear(systemId: SystemId): Promise<void> {
      await SecureStore.deleteItemAsync(keyFor(systemId), SP_TOKEN_SECURE_STORE_OPTIONS);
    },

    async hasToken(systemId: SystemId): Promise<boolean> {
      const value = await SecureStore.getItemAsync(keyFor(systemId), SP_TOKEN_SECURE_STORE_OPTIONS);
      return value !== null;
    },
  };
}
