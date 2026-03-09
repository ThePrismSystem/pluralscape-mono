/** Thrown when `getSodium()` is called before `initSodium()`. */
export class CryptoNotReadyError extends Error {
  override readonly name = "CryptoNotReadyError" as const;

  constructor(
    message = "Sodium is not initialized. Call initSodium() first.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Thrown when AEAD or box decryption fails (tampered ciphertext, wrong key). */
export class DecryptionFailedError extends Error {
  override readonly name = "DecryptionFailedError" as const;

  constructor(
    message = "Decryption failed: ciphertext is invalid or key is wrong.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Thrown when a cryptographic input has an invalid size or format. */
export class InvalidInputError extends Error {
  override readonly name = "InvalidInputError" as const;
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

/** Thrown when crypto operations are attempted while keys are cleared. */
export class KeysLockedError extends Error {
  override readonly name = "KeysLockedError" as const;

  constructor(
    message = "Keys are locked. Unlock before performing crypto operations.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Thrown when expo-secure-store operations fail. */
export class KeyStorageFailedError extends Error {
  override readonly name = "KeyStorageFailedError" as const;

  constructor(message = "Secure storage operation failed.", options?: ErrorOptions) {
    super(message, options);
  }
}

/** Thrown when biometric authentication fails after max retries. */
export class BiometricFailedError extends Error {
  override readonly name = "BiometricFailedError" as const;
  readonly retriesExhausted: boolean;

  constructor(
    retriesExhausted: boolean,
    message = "Biometric authentication failed.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.retriesExhausted = retriesExhausted;
  }
}
