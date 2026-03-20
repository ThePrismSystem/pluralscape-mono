/**
 * Sanitizes S3/AWS error details before logging to prevent credential leakage.
 *
 * Strips AWS access key IDs (AKIA...), secret access keys, and endpoint URLs
 * from error messages and stringified error objects.
 */

/** AWS access key ID pattern: starts with AKIA followed by 16 alphanumeric chars. */
const AWS_ACCESS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;

/** AWS secret key pattern: 40-char base64-ish string (alphanumeric + /+). */
const AWS_SECRET_KEY_PATTERN = /(?<=[:=]\s*")[A-Za-z0-9/+=]{40}(?=")/g;

/** S3 endpoint URL pattern. */
const S3_ENDPOINT_PATTERN = /https?:\/\/[^\s"',)]+\.amazonaws\.com[^\s"',)]*/g;

const REDACTED = "[REDACTED]";

/**
 * Sanitize a string by replacing AWS credentials and S3 endpoint URLs.
 */
export function sanitizeS3LogOutput(input: string): string {
  return input
    .replace(AWS_ACCESS_KEY_PATTERN, REDACTED)
    .replace(AWS_SECRET_KEY_PATTERN, REDACTED)
    .replace(S3_ENDPOINT_PATTERN, REDACTED);
}

/**
 * Build a safe log payload from an S3 probe error.
 * Returns a sanitized error message string suitable for structured logging.
 */
export function sanitizeS3Error(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeS3LogOutput(error.message);
  }
  return sanitizeS3LogOutput(String(error));
}
