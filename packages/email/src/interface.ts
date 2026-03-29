/**
 * Parameters for sending an email through the adapter.
 */
export interface EmailSendParams {
  /** Recipient email address(es). */
  readonly to: string | readonly string[];
  /** Email subject line. */
  readonly subject: string;
  /** HTML body of the email. */
  readonly html: string;
  /** Plain-text fallback body. */
  readonly text: string;
  /** Override the default sender address. */
  readonly from?: string;
  /** Reply-to address. */
  readonly replyTo?: string;
}

/**
 * Result of a successful email send operation.
 */
export interface EmailSendResult {
  /** Provider-assigned message ID, if available. */
  readonly messageId: string | null;
}

/**
 * Platform-agnostic email sending adapter.
 *
 * Implementations: Resend (cloud), SMTP/Nodemailer (self-hosted), Stub (no-op), InMemory (testing).
 */
export interface EmailAdapter {
  /** Human-readable provider name (e.g., "resend", "smtp", "stub"). */
  readonly providerName: string;

  /**
   * Sends an email with the given parameters.
   *
   * Throws EmailDeliveryError if the provider rejects the message.
   * Throws EmailRateLimitError if the provider rate-limits the request.
   * Throws InvalidRecipientError if the recipient address is invalid.
   * Throws EmailConfigurationError if the adapter is misconfigured.
   */
  send(params: EmailSendParams): Promise<EmailSendResult>;
}
