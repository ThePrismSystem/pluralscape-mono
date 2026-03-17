/**
 * Account management constants.
 * Domain: account routes and service layer.
 */

/** Generic error for incorrect password on account operations. */
export const INCORRECT_PASSWORD_ERROR = "Incorrect password";

/** Generic error for email change failures (anti-enumeration). */
export const EMAIL_CHANGE_FAILED_ERROR = "Email change failed";

/** Error when the new email hashes to the same value as the current one. */
export const EMAIL_UNCHANGED_ERROR = "New email must be different";
