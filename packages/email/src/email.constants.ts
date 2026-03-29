import { EmailDeliveryError, InvalidRecipientError } from "./errors.js";

/** Default sender address used when `from` is not specified in EmailSendParams. */
export const DEFAULT_FROM_ADDRESS = "noreply@pluralscape.app";

/** Maximum number of recipients allowed per send call. */
export const MAX_RECIPIENTS = 50;

/** Maximum subject line length in characters. */
export const MAX_SUBJECT_LENGTH = 998;

/**
 * Validates send parameters against package constraints.
 *
 * Throws InvalidRecipientError if too many recipients are provided.
 * Throws EmailDeliveryError if the subject line exceeds the maximum length.
 */
export function validateSendParams(params: {
  readonly to: string | readonly string[];
  readonly subject: string;
}): void {
  const recipientCount = typeof params.to === "string" ? 1 : params.to.length;
  if (recipientCount > MAX_RECIPIENTS) {
    const firstRecipient = typeof params.to === "string" ? params.to : (params.to[0] ?? "unknown");
    throw new InvalidRecipientError(firstRecipient);
  }

  if (params.subject.length > MAX_SUBJECT_LENGTH) {
    const firstRecipient = typeof params.to === "string" ? params.to : (params.to[0] ?? "unknown");
    throw new EmailDeliveryError(
      firstRecipient,
      `Subject length ${String(params.subject.length)} exceeds maximum of ${String(MAX_SUBJECT_LENGTH)} characters.`,
    );
  }
}
