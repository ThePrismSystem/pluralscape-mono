// ── Error types ────────────────────────────────────────────────────────

export class TransferValidationError extends Error {
  override readonly name = "TransferValidationError" as const;
}

export class TransferNotFoundError extends Error {
  override readonly name = "TransferNotFoundError" as const;
}

export class TransferCodeError extends Error {
  override readonly name = "TransferCodeError" as const;
}

export class TransferExpiredError extends Error {
  override readonly name = "TransferExpiredError" as const;
}

/** Thrown when the Argon2id worker pool is unavailable and key derivation cannot proceed. */
export class KeyDerivationUnavailableError extends Error {
  override readonly name = "KeyDerivationUnavailableError" as const;
}

export class TransferSessionMismatchError extends Error {
  override readonly name = "TransferSessionMismatchError" as const;
}
