import { EmailValidationError, InvalidRecipientError } from "./errors.js";

/** Default sender address used when `from` is not specified in EmailSendParams. */
export const DEFAULT_FROM_ADDRESS = "noreply@pluralscape.app";

/** Maximum number of recipients allowed per send call. */
export const MAX_RECIPIENTS = 50;

/** Maximum subject line length in characters. */
export const MAX_SUBJECT_LENGTH = 998;

/** Basic email format check (not exhaustive, just prevents obvious mistakes). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates send parameters against package constraints.
 *
 * Throws EmailValidationError if too many recipients are provided,
 * if the subject line exceeds the maximum length, or if optional
 * `from` or `replyTo` are not valid email addresses.
 */
export function validateSendParams(params: {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly from?: string;
  readonly replyTo?: string;
}): void {
  const recipientCount = typeof params.to === "string" ? 1 : params.to.length;

  if (recipientCount > MAX_RECIPIENTS) {
    throw new EmailValidationError("Recipient count", recipientCount, MAX_RECIPIENTS);
  }

  if (params.subject.length > MAX_SUBJECT_LENGTH) {
    throw new EmailValidationError("Subject length", params.subject.length, MAX_SUBJECT_LENGTH);
  }

  if (params.from !== undefined && !EMAIL_REGEX.test(params.from)) {
    throw new InvalidRecipientError(params.from);
  }

  if (params.replyTo !== undefined && !EMAIL_REGEX.test(params.replyTo)) {
    throw new InvalidRecipientError(params.replyTo);
  }
}
