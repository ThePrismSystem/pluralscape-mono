/** Options for secure key storage operations. */
export interface KeyStorageOpts {
  readonly requireBiometric: boolean;
  readonly accessibility: "afterFirstUnlock" | "whenUnlocked";
}

/**
 * Platform-agnostic interface for secure key storage.
 *
 * Implementations:
 * - WebKeyStorage: in-memory Map (web/testing)
 * - Native implementations live in apps/mobile (iOS Keychain, Android Keystore)
 *
 * All methods are async to accommodate native secure storage APIs.
 */
export interface SecureKeyStorage {
  /** Store a key. Copies bytes; memzeros any previously stored key for this id. */
  store(keyId: string, key: Uint8Array, opts?: KeyStorageOpts): Promise<void>;

  /** Retrieve a stored key. Returns a copy, or null if not found. */
  retrieve(keyId: string): Promise<Uint8Array | null>;

  /** Delete a stored key, zeroing its bytes. No-op if not found. */
  delete(keyId: string): Promise<void>;

  /** Zero and clear all stored keys. */
  clearAll(): Promise<void>;

  /** Whether this implementation requires biometric authentication. */
  requiresBiometric(): boolean;
}
