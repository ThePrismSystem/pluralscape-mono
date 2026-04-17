import * as SecureStore from "expo-secure-store";

import type { TokenStore } from "../platform/drivers/indexeddb-token-store.js";

const SESSION_KEY = "pluralscape_session_token";

/**
 * Expo SecureStore-backed token store for native platforms.
 *
 * Security posture:
 * - Stored with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` so the session token is
 *   unreadable while the device is locked and does NOT travel across device
 *   restores via iCloud / Google backup.
 * - `getToken` treats any keychain read failure as "not logged in" rather
 *   than surfacing the error to the caller. This is intentional: on the
 *   boot path we prefer to force re-authentication over crashing or
 *   exposing a keychain failure through the UI.
 */
export function createExpoSecureTokenStore(): TokenStore {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  return {
    async getToken(): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync(SESSION_KEY);
      } catch {
        // Fail-closed: if the keychain is unavailable or the value cannot
        // be read, treat the session as absent so the boot path routes the
        // user to login rather than leaking the error.
        return null;
      }
    },

    async setToken(token: string): Promise<void> {
      await SecureStore.setItemAsync(SESSION_KEY, token, options);
    },

    async clearToken(): Promise<void> {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    },
  };
}
