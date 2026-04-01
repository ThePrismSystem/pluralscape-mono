import { createIndexedDbTokenStore } from "../platform/drivers/indexeddb-token-store.js";

import type { TokenStore } from "../platform/drivers/indexeddb-token-store.js";
import type { PlatformCapabilities } from "../platform/types.js";

export type { TokenStore };

/**
 * Returns a platform-adapted TokenStore.
 *
 * On native (hasSecureStorage: true) it lazily imports the Expo SecureStore
 * wrapper so the web bundle never pulls in native modules.
 * On web it falls back to the IndexedDB-backed implementation.
 */
export async function createTokenStore(
  capabilities: Pick<PlatformCapabilities, "hasSecureStorage">,
): Promise<TokenStore> {
  if (capabilities.hasSecureStorage) {
    const { createExpoSecureTokenStore } = await import("./expo-secure-token-store.js");
    return createExpoSecureTokenStore();
  }
  return createIndexedDbTokenStore();
}
