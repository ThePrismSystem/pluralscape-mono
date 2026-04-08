// apps/mobile/src/__tests__/expo-secure-store-mock.ts
//
// In-memory mock of expo-secure-store for vitest.
// Tests can override individual methods via vi.spyOn or set throwOnNext to drive error branches.

const store = new Map<string, string>();
let throwOnNextOp: { method: string; error: Error } | null = null;

// Mock the real expo-secure-store KeychainAccessibilityConstant values (strings,
// not numbers). Production code in this repo does not currently pass options to
// SecureStore.setItemAsync, but typing these as strings matches the real API so
// future options-passing code won't fail at runtime against a number-typed mock.
export const WHEN_UNLOCKED = "AccessibleWhenUnlocked" as const;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = "AccessibleWhenUnlockedThisDeviceOnly" as const;
export const AFTER_FIRST_UNLOCK = "AccessibleAfterFirstUnlock" as const;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY =
  "AccessibleAfterFirstUnlockThisDeviceOnly" as const;

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
