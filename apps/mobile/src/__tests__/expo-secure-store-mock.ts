// apps/mobile/src/__tests__/expo-secure-store-mock.ts
//
// In-memory mock of expo-secure-store for vitest.
// Tests can override individual methods via vi.spyOn or set throwOnNext to drive error branches.

interface SecureStoreOptions {
  readonly keychainAccessible?: string;
  readonly keychainService?: string;
  readonly requireAuthentication?: boolean;
  readonly authenticationPrompt?: string;
}

type SecureStoreMethod = "getItemAsync" | "setItemAsync" | "deleteItemAsync";

const store = new Map<string, string>();
const lastOptions = new Map<string, SecureStoreOptions | undefined>();
const lastOptionsByMethod = new Map<string, SecureStoreOptions | undefined>();
let throwOnNextOp: { method: string; error: Error } | null = null;

// Mock the real expo-secure-store KeychainAccessibilityConstant values (strings,
// not numbers). Production code in this repo passes these to options
// parameters; typing them as strings matches the real API so options-passing
// code exercises the same shapes the device sees.
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

function byMethodKey(method: SecureStoreMethod, key: string): string {
  return `${method}:${key}`;
}

export function getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null> {
  maybeThrow("getItemAsync");
  lastOptionsByMethod.set(byMethodKey("getItemAsync", key), options);
  return Promise.resolve(store.has(key) ? (store.get(key) ?? null) : null);
}

export function setItemAsync(
  key: string,
  value: string,
  options?: SecureStoreOptions,
): Promise<void> {
  maybeThrow("setItemAsync");
  store.set(key, value);
  lastOptions.set(key, options);
  lastOptionsByMethod.set(byMethodKey("setItemAsync", key), options);
  return Promise.resolve();
}

export function deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void> {
  maybeThrow("deleteItemAsync");
  lastOptionsByMethod.set(byMethodKey("deleteItemAsync", key), options);
  store.delete(key);
  return Promise.resolve();
}

export function isAvailableAsync(): Promise<boolean> {
  return Promise.resolve(true);
}

// Test helpers — not part of the real expo-secure-store API.
export function __reset(): void {
  store.clear();
  lastOptions.clear();
  lastOptionsByMethod.clear();
  throwOnNextOp = null;
}

export function __lastOptions(key: string): SecureStoreOptions | undefined {
  return lastOptions.get(key);
}

export function __lastOptionsForMethod(
  method: SecureStoreMethod,
  key: string,
): SecureStoreOptions | undefined {
  return lastOptionsByMethod.get(byMethodKey(method, key));
}

export function __throwOnNext(method: SecureStoreMethod, error: Error): void {
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
