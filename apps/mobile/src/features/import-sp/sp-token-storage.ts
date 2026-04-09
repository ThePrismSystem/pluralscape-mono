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

/** Creates an SP token storage backed by Expo SecureStore. */
export function createSpTokenStorage(): SpTokenStorage {
  return {
    async get(systemId: SystemId): Promise<string | null> {
      return SecureStore.getItemAsync(keyFor(systemId));
    },

    async set(systemId: SystemId, token: string): Promise<void> {
      await SecureStore.setItemAsync(keyFor(systemId), token);
    },

    async clear(systemId: SystemId): Promise<void> {
      await SecureStore.deleteItemAsync(keyFor(systemId));
    },

    async hasToken(systemId: SystemId): Promise<boolean> {
      const value = await SecureStore.getItemAsync(keyFor(systemId));
      return value !== null;
    },
  };
}
