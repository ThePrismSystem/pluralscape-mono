/** Thrown when `getSodium()` is called before `initSodium()`. */
export class CryptoNotReadyError extends Error {
  override readonly name = "CryptoNotReadyError" as const;

  constructor() {
    super("Sodium is not initialized. Call initSodium() first.");
  }
}

/** Thrown when AEAD or box decryption fails (tampered ciphertext, wrong key). */
export class DecryptionFailedError extends Error {
  override readonly name = "DecryptionFailedError" as const;

  constructor(message = "Decryption failed: ciphertext is invalid or key is wrong.") {
    super(message);
  }
}

/** Thrown when `configureSodium()` is called after initialization. */
export class AlreadyInitializedError extends Error {
  override readonly name = "AlreadyInitializedError" as const;

  constructor() {
    super("Sodium is already initialized. configureSodium() must be called before initSodium().");
  }
}

/** Thrown when a method is not supported on the current platform adapter. */
export class UnsupportedOperationError extends Error {
  override readonly name = "UnsupportedOperationError" as const;

  constructor(operation: string, platform: string) {
    super(
      `${operation} is not supported on ${platform}. See adapter documentation for alternatives.`,
    );
  }
}
