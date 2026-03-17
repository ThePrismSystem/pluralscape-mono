/**
 * Validation-layer constants.
 * Domain: schema validation rules shared across packages.
 */

/** Minimum password length enforced at the validation layer (mirrors crypto MIN_PASSWORD_LENGTH). */
export const AUTH_MIN_PASSWORD_LENGTH = 8;

/**
 * Maximum base64-encoded string length for encrypted data fields.
 * Equals Math.ceil(65_536 * 4/3) = 87_382 — the base64 encoding of 64 KiB,
 * aligned with the service-layer byte limit (MAX_ENCRYPTED_DATA_BYTES).
 */
export const MAX_ENCRYPTED_DATA_SIZE = 87_382;

/** Maximum number of group reorder operations in a single batch request. */
export const MAX_REORDER_OPERATIONS = 100;
