import * as SecureStore from "expo-secure-store";

import type { TokenStore } from "../platform/drivers/indexeddb-token-store.js";

const SESSION_KEY = "pluralscape_session_token";

/** Expo SecureStore-backed token store for native platforms. */
export function createExpoSecureTokenStore(): TokenStore {
  return {
    async getToken(): Promise<string | null> {
      return SecureStore.getItemAsync(SESSION_KEY);
    },

    async setToken(token: string): Promise<void> {
      await SecureStore.setItemAsync(SESSION_KEY, token);
    },

    async clearToken(): Promise<void> {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    },
  };
}
