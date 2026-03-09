import { AlreadyInitializedError, CryptoNotReadyError } from "./errors.js";

import type { SodiumAdapter } from "./adapter/interface.js";

let adapter: SodiumAdapter | null = null;
let initialized = false;

/**
 * Set a custom adapter (e.g., ReactNativeSodiumAdapter) before initialization.
 * Must be called before `initSodium()`. Throws if already initialized.
 */
export function configureSodium(custom: SodiumAdapter): void {
  if (initialized) {
    throw new AlreadyInitializedError();
  }
  adapter = custom;
}

/**
 * Initialize the sodium adapter. Idempotent — safe to call multiple times.
 * If no adapter was configured via `configureSodium()`, defaults to WasmSodiumAdapter.
 */
export async function initSodium(): Promise<void> {
  if (initialized) {
    return;
  }

  if (adapter === null) {
    const { WasmSodiumAdapter } = await import("./adapter/wasm-adapter.js");
    adapter = new WasmSodiumAdapter();
  }

  await adapter.init();
  initialized = true;
}

/**
 * Get the initialized sodium adapter. Synchronous — throws if not yet initialized.
 * @throws {CryptoNotReadyError} if `initSodium()` has not been called.
 */
export function getSodium(): SodiumAdapter {
  if (!initialized || adapter === null) {
    throw new CryptoNotReadyError();
  }
  return adapter;
}

/** Check whether sodium has been initialized. */
export function isReady(): boolean {
  return initialized;
}

/**
 * Reset sodium state. FOR TESTING ONLY — allows re-initialization.
 * @internal
 */
export function _resetForTesting(): void {
  adapter = null;
  initialized = false;
}
