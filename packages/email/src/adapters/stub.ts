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
  send(_params: EmailSendParams): Promise<EmailSendResult> {
    return Promise.resolve({ messageId: null });
  }
}
