import { EmailValidationError, InvalidRecipientError } from "./errors.js";

/** Default sender address used when `from` is not specified in EmailSendParams. */
export const DEFAULT_FROM_ADDRESS = "noreply@pluralscape.app";

/** Maximum number of recipients allowed per send call. */
export const MAX_RECIPIENTS = 50;

/** Maximum subject line length in characters. */
export const MAX_SUBJECT_LENGTH = 998;

/**
 * Basic email format check (not exhaustive, just prevents obvious mistakes).
 *
 * Implemented as a linear split rather than a regex to avoid polynomial-time
 * backtracking on adversarial inputs (CodeQL js/polynomial-redos).
 */
function isValidEmailShape(value: string): boolean {
  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (domain.length === 0) return false;

  for (const ch of local) {
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return false;
  }

  let sawDot = false;
  for (let i = 0; i < domain.length; i++) {
    const ch = domain[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "@") return false;
    if (ch === ".") {
      if (i === 0 || i === domain.length - 1) return false;
      sawDot = true;
    }
  }
  return sawDot;
}

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

  if (params.from !== undefined && !isValidEmailShape(params.from)) {
    throw new InvalidRecipientError(params.from);
  }

  if (params.replyTo !== undefined && !isValidEmailShape(params.replyTo)) {
    throw new InvalidRecipientError(params.replyTo);
  }
}
