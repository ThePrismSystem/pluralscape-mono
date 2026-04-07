// apps/mobile/src/__tests__/expo-secure-store-mock.ts
//
// In-memory mock of expo-secure-store for vitest.
// Tests can override individual methods via vi.spyOn or set throwOnNext to drive error branches.

const store = new Map<string, string>();
let throwOnNextOp: { method: string; error: Error } | null = null;

export const SecureStoreOptions = {
  WHEN_UNLOCKED: 0,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  AFTER_FIRST_UNLOCK: 2,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 3,
} as const;

export const WHEN_UNLOCKED = SecureStoreOptions.WHEN_UNLOCKED;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = SecureStoreOptions.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
export const AFTER_FIRST_UNLOCK = SecureStoreOptions.AFTER_FIRST_UNLOCK;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY =
  SecureStoreOptions.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;

function maybeThrow(method: string): void {
  if (throwOnNextOp?.method === method) {
    const err = throwOnNextOp.error;
    throwOnNextOp = null;
    throw err;
  }
}

export function getItemAsync(key: string): Promise<string | null> {
  maybeThrow("getItemAsync");
  return Promise.resolve(store.has(key) ? (store.get(key) ?? null) : null);
}

export function setItemAsync(key: string, value: string): Promise<void> {
  maybeThrow("setItemAsync");
  store.set(key, value);
  return Promise.resolve();
}

export function deleteItemAsync(key: string): Promise<void> {
  maybeThrow("deleteItemAsync");
  store.delete(key);
  return Promise.resolve();
}

export function isAvailableAsync(): Promise<boolean> {
  return Promise.resolve(true);
}

// Test helpers — not part of the real expo-secure-store API.
export function __reset(): void {
  store.clear();
  throwOnNextOp = null;
}

export function __throwOnNext(
  method: "getItemAsync" | "setItemAsync" | "deleteItemAsync",
  error: Error,
): void {
  throwOnNextOp = { method, error };
}

export function __snapshot(): Record<string, string> {
  return Object.fromEntries(store);
}

export default {
  WHEN_UNLOCKED,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  AFTER_FIRST_UNLOCK,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};
