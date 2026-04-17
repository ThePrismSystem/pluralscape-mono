/**
 * Account management constants.
 * Domain: account routes and service layer.
 */

/** Generic error for email change failures (anti-enumeration). */
export const EMAIL_CHANGE_FAILED_ERROR = "Email change failed";

/**
 * Idempotency key prefix for the fire-and-forget `account-change-email`
 * notification enqueued after a successful email change. Concatenated with
 * `:accountId:version` by {@link buildAccountEmailChangeIdempotencyKey} —
 * `version` is the post-change `accounts.version`, so retries of the same
 * change dedupe and subsequent legitimate changes get fresh keys.
 */
export const ACCOUNT_EMAIL_CHANGE_IDEMPOTENCY_PREFIX = "email:account-change";

/** Build the idempotency key for the account-change-email enqueue. */
export function buildAccountEmailChangeIdempotencyKey(accountId: string, version: number): string {
  return `${ACCOUNT_EMAIL_CHANGE_IDEMPOTENCY_PREFIX}:${accountId}:${String(version)}`;
}
