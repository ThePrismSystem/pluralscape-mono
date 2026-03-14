import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";

import type { SecureKeyStorage } from "./key-storage.js";

function validateKeyId(keyId: string): InvalidInputError | null {
  if (keyId.length === 0) {
    return new InvalidInputError("keyId must be a non-empty string.");
  }
  return null;
}

/**
 * In-memory SecureKeyStorage implementation for web/testing.
 *
 * Keys are zeroed via memzero when removed or replaced. Retrieve returns
 * a copy — callers may memzero their copy when done with it.
 *
 * Not persistent: all keys are lost when the page is closed.
 * The opts parameter is accepted but ignored (no biometric or accessibility
 * controls apply in a web/in-memory context).
 */
export function createWebKeyStorage(): SecureKeyStorage {
  const store = new Map<string, Uint8Array>();

  return {
    store(keyId: string, key: Uint8Array): Promise<void> {
      const err = validateKeyId(keyId);
      if (err !== null) return Promise.reject(err);
      const existing = store.get(keyId);
      if (existing !== undefined) {
        getSodium().memzero(existing);
      }
      store.set(keyId, new Uint8Array(key));
      return Promise.resolve();
    },

    retrieve(keyId: string): Promise<Uint8Array | null> {
      const err = validateKeyId(keyId);
      if (err !== null) return Promise.reject(err);
      const stored = store.get(keyId);
      return Promise.resolve(stored !== undefined ? new Uint8Array(stored) : null);
    },

    delete(keyId: string): Promise<void> {
      const err = validateKeyId(keyId);
      if (err !== null) return Promise.reject(err);
      const existing = store.get(keyId);
      if (existing !== undefined) {
        getSodium().memzero(existing);
        store.delete(keyId);
      }
      return Promise.resolve();
    },

    clearAll(): Promise<void> {
      const adapter = getSodium();
      try {
        for (const key of store.values()) {
          adapter.memzero(key);
        }
      } finally {
        store.clear();
      }
      return Promise.resolve();
    },

    requiresBiometric(): boolean {
      return false;
    },
  };
}
