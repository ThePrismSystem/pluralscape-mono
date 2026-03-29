import type { EmailAdapter, EmailSendParams, EmailSendResult } from "../interface.js";

/**
 * No-op email adapter that logs send calls without actually delivering.
 *
 * Suitable as a production fallback when no email provider is configured,
 * similar to StubPushProvider in the notifications package.
 */
export class StubEmailAdapter implements EmailAdapter {
  readonly providerName = "stub" as const;

  /** Accepts params for interface conformance but does not deliver. */
  send(params: EmailSendParams): Promise<EmailSendResult> {
    // Destructure to satisfy the unused-vars rule while keeping the interface contract
    void params;
    return Promise.resolve({ messageId: null });
  }
}
