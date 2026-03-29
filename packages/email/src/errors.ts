/**
 * Thrown when the email provider rejects or fails to deliver a message.
 */
export class EmailDeliveryError extends Error {
  override readonly name = "EmailDeliveryError" as const;
  readonly recipient: string;

  constructor(recipient: string, message?: string, options?: ErrorOptions) {
    super(message ?? `Failed to deliver email to "${recipient}".`, options);
    this.recipient = recipient;
  }
}

/**
 * Thrown when the email adapter is misconfigured (e.g., missing API key, invalid host).
 */
export class EmailConfigurationError extends Error {
  override readonly name = "EmailConfigurationError" as const;
}

/**
 * Thrown when the email provider rate-limits the request.
 */
export class EmailRateLimitError extends Error {
  override readonly name = "EmailRateLimitError" as const;
  /** Seconds until the rate limit resets, if provided by the provider. */
  readonly retryAfterSeconds: number | null;

  constructor(retryAfterSeconds?: number, options?: ErrorOptions) {
    super(
      retryAfterSeconds !== undefined
        ? `Rate limited — retry after ${String(retryAfterSeconds)} seconds.`
        : "Rate limited by email provider.",
      options,
    );
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

/**
 * Thrown when the recipient email address is invalid or rejected by the provider.
 */
export class InvalidRecipientError extends Error {
  override readonly name = "InvalidRecipientError" as const;
  readonly recipient: string;

  constructor(recipient: string, options?: ErrorOptions) {
    super(`Invalid recipient address: "${recipient}".`, options);
    this.recipient = recipient;
  }
}
